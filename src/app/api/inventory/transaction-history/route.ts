
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, InventoryTransaction } from '@/types/server-only';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

async function authorizeAccess(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === requestedDataOwnerId) return true;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) return false;
  
  const authUserProfile = authUserProfileDoc.data() as UserProfile;
  if (authUserProfile.ownerId === requestedDataOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      return teamMemberData.permissions?.canManageInventory || false;
    }
  }
  return false;
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token', details: error.message }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    const inventoryItemId = url.searchParams.get('inventoryItemId');

    if (!dataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId is required.' }, { status: 400 });
    }
    
    const hasPermission = await authorizeAccess(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });
    }
    
    let query: admin.firestore.Query = adminDb.collection('inventoryTransactions').where('userId', '==', dataOwnerId);

    // Note: The orderBy was removed to prevent composite index errors. Sorting is now done in the backend code.
    const transactionsSnapshot = await query.limit(2000).get(); // Increased limit slightly
      
    let transactions: InventoryTransaction[] = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTransaction));
    
    // Manual filtering and sorting
    if (inventoryItemId) {
        transactions = transactions.filter(tx => tx.inventoryItemId === inventoryItemId);
    }
    
    transactions.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

    return NextResponse.json(transactions, { status: 200 });

  } catch (error: any) {
    console.error(`Error in /api/inventory/transaction-history:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
