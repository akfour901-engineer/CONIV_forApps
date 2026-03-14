import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { PaymentTransaction, UserProfile } from '@/types/server-only';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

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
      console.error('Token verification error in /api/admin/payment-transactions GET:', error.code, error.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    
    if (!userProfileDoc.exists) {
      return NextResponse.json({ error: 'Forbidden: User profile not found' }, { status: 403 });
    }
    const userProfile = userProfileDoc.data() as UserProfile;
    if (!userProfile.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: User is not an administrator' }, { status: 403 });
    }

    const transactionsSnapshot = await adminDb.collection('paymentTransactions')
      .orderBy('transactionDate', 'desc')
      .get();

    const transactions: PaymentTransaction[] = transactionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
      } as PaymentTransaction;
    });

    const userIds = Array.from(new Set(transactions.map(tx => tx.userId)));
    const userProfiles = new Map<string, { fullName?: string, email?: string }>();
    
    if (userIds.length > 0) {
        // Firestore 'in' queries are limited to 30 items. Chunking is needed for larger sets.
        const MAX_IDS_PER_QUERY = 30;
        const userIdChunks: string[][] = [];
        for (let i = 0; i < userIds.length; i += MAX_IDS_PER_QUERY) {
            userIdChunks.push(userIds.slice(i, i + MAX_IDS_PER_QUERY));
        }

        for (const chunk of userIdChunks) {
            if (chunk.length > 0) {
                 const userDocsSnapshot = await adminDb.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
                 userDocsSnapshot.forEach(doc => {
                    const data = doc.data();
                    userProfiles.set(doc.id, { fullName: data.fullName, email: data.email });
                });
            }
        }
    }

    const enrichedTransactions = transactions.map(tx => {
        const profile = userProfiles.get(tx.userId);
        return {
            ...tx,
            userName: profile?.fullName || tx.userName || 'Unknown User',
            email: profile?.email || tx.metadata?.userEmail || 'N/A',
        };
    });
    
    return NextResponse.json(enrichedTransactions, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/payment-transactions GET handler:', error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
