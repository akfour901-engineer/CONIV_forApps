import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, EnrichedUserProfile, TeamPermissions } from '@/types/server-only';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const functionCallId = `api_get_profile_GET_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    
    const idToken = authorizationHeader.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch(error: any) {
        console.warn(`[${functionCallId}] Token verification failed:`, error.message);
        return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', code: error.code || 'AUTH_ERROR' }, { status: 401 });
    }

    const uid = decodedToken.uid;

    const userProfileDoc = await adminDb.collection('users').doc(uid).get();

    if (!userProfileDoc.exists) {
      console.warn(`[${functionCallId}] User profile not found for UID: ${uid}`);
      return NextResponse.json({ error: 'User profile not found in database.' }, { status: 404 });
    }

    const userProfile = { uid: userProfileDoc.id, ...userProfileDoc.data() } as UserProfile;
    
    let teamMemberPermissions: TeamPermissions | null = null;
    let teamOwnerProfileData: UserProfile | null = null;
    
    // If the user is a team member (identified by having an ownerId different from their own uid)
    if (userProfile.ownerId && userProfile.ownerId !== userProfile.uid) {
      const teamMemberDocRef = adminDb.collection('users').doc(userProfile.ownerId).collection('teamMembers').doc(uid);
      const teamMemberSnap = await teamMemberDocRef.get();
      
      if (teamMemberSnap.exists) {
        const teamMemberData = teamMemberSnap.data() as TeamMember;
        if (teamMemberData) { // Check if teamMemberData is not undefined
          teamMemberPermissions = teamMemberData.permissions;
        }

        const ownerProfileDocRef = adminDb.collection('users').doc(userProfile.ownerId);
        const ownerProfileSnap = await ownerProfileDocRef.get();
        if (ownerProfileSnap.exists) {
          teamOwnerProfileData = { uid: ownerProfileSnap.id, ...ownerProfileSnap.data() } as UserProfile;
        }
      }
    }
    
    const enrichedProfile: EnrichedUserProfile = {
      userProfile,
      teamMemberPermissions,
      teamOwnerProfileData,
    };

    return NextResponse.json(enrichedProfile, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/get-profile:`, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' },
      { status: 500 }
    );
  }
}
