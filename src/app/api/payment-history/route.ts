import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { PaymentTransaction, UserProfile, TeamMember } from '@/types/server-only';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
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

    // Authorization check
    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true; // User viewing their own data
    } else {
      const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if(authUserProfileDoc.exists) {
        const authUserProfile = authUserProfileDoc.data() as UserProfile;
        if(authUserProfile.ownerId === requestedDataOwnerId) { // check if authUser is member of requested owner
            const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if(teamMemberDocSnap.exists) {
                const permissions = (teamMemberDocSnap.data() as TeamMember).permissions;
                // Allow if they can manage coins or view financial summaries
                if (permissions?.canManageCoinsAndPayments || permissions?.canViewFinancialSummaries) {
                  canAccess = true;
                }
            }
        }
      }
    }
    
    if (!canAccess) {
        return NextResponse.json({ error: 'Forbidden: You are not authorized to view this payment history.' }, { status: 403 });
    }

    const transactionsSnapshot = await adminDb.collection('paymentTransactions')
      .where('userId', '==', requestedDataOwnerId) // Query for the owner of the data context
      .orderBy('transactionDate', 'desc')
      .get();

    const transactions: PaymentTransaction[] = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentTransaction));
    
    return NextResponse.json(transactions, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/payment-history GET handler:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
