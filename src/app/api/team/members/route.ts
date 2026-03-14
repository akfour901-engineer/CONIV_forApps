
import { NextResponse } from 'next/server';
import type { TeamMember, UserProfile } from '@/types/server-only'; 
import { getDb, getAuth } from '@/lib/firebase-admin-init';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  const functionCallId = `api_team_members_GET_${Date.now()}`;
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const url = new URL(request.url);
    const dataOwnerIdToQuery = url.searchParams.get('dataOwnerId');
    if (!dataOwnerIdToQuery) {
        return NextResponse.json({ error: 'Bad Request: dataOwnerId query parameter is required.' }, { status: 400 });
    }

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return NextResponse.json({ error: 'Forbidden: User profile not found, cannot determine team scope.', code: 'AUTH_USER_PROFILE_NOT_FOUND_MEMBERS_GET'}, { status: 403 });
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;
    
    let canAccess = false;
    // Case 1: User is viewing their own team.
    if (authenticatedUserUid === dataOwnerIdToQuery) { 
      canAccess = true;
    } 
    // Case 2: User is a team member viewing the team they belong to.
    else if (authUserProfile.ownerId === dataOwnerIdToQuery) { 
      canAccess = true;
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view this team.' }, { status: 403 });
    }
    
    const membersSnapshot = await adminDb.collection(`users/${dataOwnerIdToQuery}/teamMembers`)
      .where('status', '==', 'active')
      .orderBy('name', 'asc')
      .get();
      
    const members: TeamMember[] = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember));
    return NextResponse.json(members, { status: 200 });
  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/team/members GET error:`, error);
    let errorMessage = error.message || "An unspecified error occurred.";
    let errorCode = error.code || 'UNKNOWN_SERVER_ERROR_MEMBERS_GET';
     if (error.code === 'FAILED_PRECONDITION') {
      errorMessage = "A database index is required for this query (e.g., on users/{ownerId}/teamMembers for status and name). Check server logs for a Firestore link to create it.";
    }
    return NextResponse.json({ error: 'Internal server error', details: errorMessage, code: errorCode }, { status: 500 });
  }
}
