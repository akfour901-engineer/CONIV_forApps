

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { TeamInvitation, UserProfile } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const inviteeUid = decodedToken.uid;

    const userProfileDoc = await adminDb.collection('users').doc(inviteeUid).get();

    if (!userProfileDoc.exists) {
      return NextResponse.json({ error: 'User profile not found for invitee' }, { status: 403 });
    }
    const userProfile = userProfileDoc.data() as UserProfile;

    const filters = [];
    if (userProfile.email) {
      filters.push(admin.firestore.Filter.where('invitedEmail', '==', userProfile.email));
    }
    if (userProfile.phoneNumber) {
      filters.push(admin.firestore.Filter.where('invitedPhoneNumber', '==', userProfile.phoneNumber));
    }

    if (filters.length === 0) {
      return NextResponse.json([], { status: 200 });
    }
    
    const orFilter = admin.firestore.Filter.or(...filters);
    const finalFilter = admin.firestore.Filter.and(
        orFilter,
        admin.firestore.Filter.where('status', '==', 'pending')
    );

    const invitationsSnapshot = await adminDb.collection('teamInvitations')
      .where(finalFilter)
      .orderBy('createdAt', 'desc')
      .get();
      
    const invitations: TeamInvitation[] = invitationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamInvitation));
    return NextResponse.json(invitations, { status: 200 });
  } catch (error: any) {
    console.error('API /api/team/my-invitations GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
