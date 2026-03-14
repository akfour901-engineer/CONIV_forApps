import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin-init';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const lookupSchema = z.object({
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
}).refine(data => data.phoneNumber || data.email, {
  message: "Either phoneNumber or email must be provided.",
});

export async function POST(request: Request) {
  const adminDb = getDb();
  try {
    const requestBody = await request.json();
    const validationResult = lookupSchema.safeParse(requestBody);
    if (!validationResult.success) {
        return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const { phoneNumber, email } = validationResult.data;
    
    let query;
    if (phoneNumber) {
        query = adminDb.collection('users').where("phoneNumber", "==", phoneNumber).limit(1);
    } else if (email) {
        query = adminDb.collection('users').where("email", "==", email).limit(1);
    } else {
        return NextResponse.json({ error: 'A search parameter is required.' }, { status: 400 });
    }

    const querySnapshot = await query.get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    
    const userData = querySnapshot.docs[0].data();
    
    if (!userData.email) {
      return NextResponse.json({ error: 'Associated account does not have an email address.' }, { status: 400 });
    }

    return NextResponse.json({ email: userData.email }, { status: 200 });

  } catch (error: any) {
    console.error("API /users/lookup POST error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
