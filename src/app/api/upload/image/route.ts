


import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin-init';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided.' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: 'No image file found in the request.' }, { status: 400 });
    }

    const bucket = getStorage().bucket('gs://contractx-e3ab6.appspot.com');
    const fileName = `marketing_images/${userId}/${uuidv4()}-${image.name}`;
    const file = bucket.file(fileName);

    const imageBuffer = Buffer.from(await image.arrayBuffer());

    await new Promise((resolve, reject) => {
      const stream = file.createWriteStream({
        metadata: { contentType: image.type },
        resumable: false,
      });
      stream.on('error', (err) => {
        console.error('Upload stream error:', err);
        reject(new Error('Failed to upload image.'));
      });
      stream.on('finish', resolve);
      stream.end(imageBuffer);
    });

    await file.makePublic();
    const publicUrl = file.publicUrl();

    return NextResponse.json({ url: publicUrl }, { status: 200 });

  } catch (error: any) {
    console.error('[API/upload/image] Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
