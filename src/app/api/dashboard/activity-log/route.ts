import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, ActivityLog } from '@/types';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<{ authorized: boolean; error?: NextResponse }> {
    const adminDb = getDb();
    if (authenticatedUserUid === requestedDataOwnerId) {
        return { authorized: true }; // Owner can view their own log
    }

    const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!memberProfileDoc.exists) {
        return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 }) };
    }
    const memberProfile = memberProfileDoc.data() as UserProfile;

    // Check if the authenticated user is a team member of the requested data owner
    if (memberProfile.ownerId === requestedDataOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canViewActivityLog) {
                return { authorized: true };
            }
        }
    }
    
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Not authorized to view this activity log.' }, { status: 403 }) };
}


export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    if (!dataOwnerId) {
      return NextResponse.json({ error: 'dataOwnerId is required' }, { status: 400 });
    }

    const authCheck = await checkPermissions(decodedToken.uid, dataOwnerId);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }
    
    // The base query is always filtered by ownerId
    // Fixed: Removed orderBy from query to avoid needing a composite index
    let logsQuery: admin.firestore.Query = adminDb.collection('activityLogs').where('ownerId', '==', dataOwnerId);
    
    const logsSnapshot = await logsQuery.get();
    
    const logs: ActivityLog[] = logsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json(logs, { status: 200 });

  } catch (error: any) {
    console.error("API GET /api/dashboard/activity-log error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
