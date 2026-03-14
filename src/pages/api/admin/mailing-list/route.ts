
'use server';

import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { MailingListEntry, UserProfile } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';

const entryCreateSchema = z.object({
  email: z.string().email("Invalid email format."),
  name: z.string().max(100).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  organizationId: z.string().optional().nullable(),
  subcontractorId: z.string().optional().nullable(),
  mailingListIds: z.array(z.string()).optional(),
  userId: z.string(), // Added userId to schema for creation
});

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userProfileDoc.exists || !userProfileDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
    }

    const snapshot = await adminDb.collection('mailingList').orderBy('createdAt', 'desc').get();
    const entries: MailingListEntry[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailingListEntry));
    
    return NextResponse.json(entries, { status: 200 });
  } catch (error: any) {
    console.error("API /admin/mailing-list GET error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
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
    
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userProfileDoc.exists || !userProfileDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actorProfile = userProfileDoc.data() as UserProfile;

    const requestBody = await request.json();
    const validationResult = entryCreateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { userId, ...data } = validationResult.data;

    const existingEntryQuery = adminDb.collection('mailingList').where('userId', '==', userId).where('email', '==', data.email).limit(1);
    const existingEntrySnap = await existingEntryQuery.get();
    if (!existingEntrySnap.empty) {
      return NextResponse.json({ error: 'An entry with this email already exists for the specified user.' }, { status: 409 });
    }
    
    const now = new Date().toISOString();
    const newEntryData: Omit<MailingListEntry, "id"> = {
        ...data,
        userId: userId,
        status: 'manual_entry',
        source: 'manual',
        addedByUid: decodedToken.uid,
        addedByName: actorProfile.fullName || actorProfile.email!,
        createdAt: now,
        updatedAt: now,
    };
    
    const docRef = await adminDb.collection('mailingList').add(newEntryData);

    await logActivity({
        ownerId: userId,
        actorUid: decodedToken.uid,
        actorName: actorProfile.fullName || actorProfile.email || "Admin",
        actionType: 'mailing_list_contact_added',
        entityType: 'MailingListEntry',
        entityId: docRef.id,
        entityName: data.email,
    });
    
    return NextResponse.json({ id: docRef.id, ...newEntryData }, { status: 201 });

  } catch(error: any) {
    console.error("API /admin/mailing-list POST error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
