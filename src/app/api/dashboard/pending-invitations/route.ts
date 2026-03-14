import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { TeamInvitation, UserProfile } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';

export const dynamic = 'force-dynamic';

/**
 * @api {get} /api/dashboard/pending-invitations
 * @description Fetches all pending team invitations for the currently authenticated user.
 * This route checks for invitations where the user's email or phone number matches the invite.
 */
export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
        return NextResponse.json({ error: 'Unauthorized: Invalid token', code: error.code }, { status: 401 });
    }
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
      // If user has no email or phone, they can't have any invitations.
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
    console.error('API /api/dashboard/pending-invitations GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
