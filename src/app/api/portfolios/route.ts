import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { Portfolio, UserProfile, TeamMember } from '@/types/server-only';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authAdmin = getAuth();
    const adminDb = getDb();

    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;
        
        const url = new URL(request.url);
        const dataOwnerId = url.searchParams.get('dataOwnerId');

        if (!dataOwnerId) {
             return NextResponse.json({ error: 'Forbidden: dataOwnerId is required.' }, { status: 403 });
        }

        let canAccess = false;
        if (authenticatedUserUid === dataOwnerId) {
            canAccess = true;
        } else {
            const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
            if (memberProfileDoc.exists && (memberProfileDoc.data() as UserProfile).ownerId === dataOwnerId) {
                const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
                if (teamMemberDoc.exists && (teamMemberDoc.data() as TeamMember).permissions?.canManageCompanies) {
                    canAccess = true;
                }
            }
        }
        
        if (!canAccess) {
             return NextResponse.json({ error: 'Forbidden: You do not have permission to view these portfolios.' }, { status: 403 });
        }


        // Fetch without ordering by 'createdAt' to avoid composite index requirement
        const snapshot = await adminDb.collection('portfolios').where('userId', '==', dataOwnerId).get();
        const portfolios: Portfolio[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Portfolio));
        
        // Perform sorting in code
        portfolios.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(portfolios, { status: 200 });
    } catch (error: any) {
        console.error('API GET /api/portfolios error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
