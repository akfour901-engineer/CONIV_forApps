


import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { MailingList, UserProfile } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const listCreateSchema = z.object({
  name: z.string().min(2, "List name is required.").max(100),
  description: z.string().max(200).optional().nullable(),
  userId: z.string().min(1, "User ID is required."),
});

export async function GET(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        
        const url = new URL(request.url);
        const dataOwnerId = url.searchParams.get('dataOwnerId');
        if (!dataOwnerId) return NextResponse.json({ error: 'dataOwnerId is required' }, { status: 400 });

        if (decodedToken.uid !== dataOwnerId) {
             // In a real multi-tenant app, you'd check team permissions here
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const snapshot = await adminDb.collection('mailingLists').where('userId', '==', dataOwnerId).get();
        let lists: MailingList[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailingList));
        
        // Perform sorting in code to avoid needing a composite index
        lists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(lists, { status: 200 });

    } catch (error: any) {
        console.error("API /marketing/mailing-lists GET error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}


export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const actorUid = decodedToken.uid;
    
    const requestBody = await request.json();
    const validationResult = listCreateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const data = validationResult.data;

    if (actorUid !== data.userId) {
        // More complex team permission logic would go here in a real app
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const actorProfileSnap = await adminDb.collection('users').doc(actorUid).get();
    if (!actorProfileSnap.exists) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 403 });
    }
    const actorProfile = actorProfileSnap.data() as UserProfile;

    const now = new Date().toISOString();
    const newListData: Omit<MailingList, 'id'> = {
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await adminDb.collection('mailingLists').add(newListData);

    await logActivity({
      ownerId: data.userId,
      actorUid: actorUid,
      actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create',
      entityType: 'MailingList',
      entityId: docRef.id,
      entityName: data.name,
    });

    return NextResponse.json({ id: docRef.id, ...newListData }, { status: 201 });

  } catch (error: any) {
    console.error("API /marketing/mailing-lists POST error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
