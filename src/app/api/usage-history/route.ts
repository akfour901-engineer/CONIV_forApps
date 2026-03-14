import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { ActivityLog, UserProfile, TeamMember } from '@/types/server-only';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authAdmin = getAuth();
    const adminDb = getDb();
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');

    if (!requestedDataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId query parameter is required' }, { status: 400 });
    }
    
    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!userProfileDoc.exists) {
        return NextResponse.json({ error: 'Forbidden: User profile not found.' }, { status: 403 });
    }
    const userProfile = userProfileDoc.data() as UserProfile;
    
    let canAccess = false;
    // Case 1: The user is the owner of the data they are requesting.
    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true;
    } 
    // Case 2: The user is a team member, check if their ownerId matches the requested data owner.
    else if (userProfile.ownerId === requestedDataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const permissions = (teamMemberDocSnap.data() as TeamMember).permissions;
        // Grant access if they have permission to view financial summaries.
        if (permissions?.canViewFinancialSummaries) {
          canAccess = true;
        }
      }
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden: You are not authorized to view this usage history.' }, { status: 403 });
    }

    // Fixed: Removed orderBy to avoid index requirement
    const logsSnapshot = await adminDb.collection('activityLogs')
      .where('ownerId', '==', requestedDataOwnerId)
      .get();
      
    const logs = logsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog))
      .filter(log => {
          // This logic determines what shows up in the usage history.
          if (log.actionType === 'coin_purchase_success' || log.actionType === 'support_payment_success' || log.actionType === 'daily_check_in_reward') {
              return true;
          }
          if (log.details && typeof log.details === 'object') {
            const hasCost = 'cost' in log.details && typeof log.details.cost === 'number' && log.details.cost > 0;
            // Banner rewards should also be included
            const hasPointsAwarded = 'pointsAwarded' in log.details && typeof log.details.pointsAwarded === 'number' && log.details.pointsAwarded > 0;
            return hasCost || hasPointsAwarded;
          }
          return false;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(logs, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/usage-history GET handler:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
