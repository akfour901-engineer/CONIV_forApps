import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import type { Portfolio, TeamMember, UserProfile } from '@/types/server-only';
export const dynamic = 'force-dynamic';
const portfolioUpdateSchema = z.object({
  portfolioName: z.string().min(3, "Name must be at least 3 characters.").optional(),
  themeColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color.").optional(),
  content: z.string().min(1, "HTML content cannot be empty.").optional(),
});

async function authorizeAccess(
    portfolioId: string,
    authenticatedUserUid: string
) {
    const adminDb = getDb();
    const docRef = adminDb.collection('portfolios').doc(portfolioId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        return { authorized: false, error: 'Portfolio not found', status: 404 };
    }

    const portfolio = { id: docSnap.id, ...docSnap.data() } as Portfolio;
    const itemOwnerId = portfolio.userId;

    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found', status: 403 };
    }
    const actorProfile = { uid: actorProfileDoc.id, ...actorProfileDoc.data() } as UserProfile;
    
    if (authenticatedUserUid === itemOwnerId) {
        return { authorized: true, portfolio, dataOwnerId: itemOwnerId, actorProfile };
    }
    
    if (actorProfile.ownerId && actorProfile.ownerId === itemOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageCompanies) {
                return { authorized: true, portfolio, dataOwnerId: itemOwnerId, actorProfile };
            }
        }
    }

    return { authorized: false, error: 'Forbidden: You do not have permission for this portfolio.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { portfolioId: string } }) {
    const { portfolioId } = params;
    try {
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        
        const authResult = await authorizeAccess(portfolioId, decodedToken.uid);

        if (!authResult.authorized || !authResult.portfolio) {
            return NextResponse.json({ error: authResult.error || 'Not Found or Access Denied' }, { status: authResult.status || 404 });
        }
        
        return NextResponse.json(authResult.portfolio, { status: 200 });

    } catch (error: any) {
        console.error(`API GET /api/portfolios/[portfolioId] error:`, error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { portfolioId: string } }) {
    const { portfolioId } = params;
    try {
        const authAdmin = getAuth();
        const adminDb = getDb();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        const authResult = await authorizeAccess(portfolioId, decodedToken.uid);
        if (!authResult.authorized || !authResult.portfolio || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error || 'Forbidden' }, { status: authResult.status || 403 });
        }
        
        const requestBody = await request.json();
        const validationResult = portfolioUpdateSchema.safeParse(requestBody);

        if(!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
        }

        const dataToUpdate = {
            ...validationResult.data,
            updatedAt: new Date().toISOString(),
        };

        const docRef = adminDb.collection('portfolios').doc(portfolioId);
        await docRef.update(dataToUpdate);

        await logActivity({
          ownerId: authResult.dataOwnerId!,
          actorUid: decodedToken.uid,
          actorName: authResult.actorProfile.fullName || authResult.actorProfile.email || 'User',
          actionType: 'portfolio_updated',
          entityType: 'Portfolio',
          entityId: portfolioId,
          entityName: dataToUpdate.portfolioName || authResult.portfolio.portfolioName,
          details: `Portfolio "${dataToUpdate.portfolioName || authResult.portfolio.portfolioName}" was updated.`
        });

        const updatedDoc = await docRef.get();

        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (error: any) {
        console.error(`API PUT /api/portfolios/[portfolioId] error:`, error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { portfolioId: string } }) {
    const { portfolioId } = params;
    try {
        const authAdmin = getAuth();
        const adminDb = getDb();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        const authResult = await authorizeAccess(portfolioId, decodedToken.uid);
        if (!authResult.authorized || !authResult.portfolio) {
            return NextResponse.json({ error: authResult.error || 'Forbidden' }, { status: authResult.status || 403 });
        }

        await adminDb.collection('portfolios').doc(portfolioId).delete();
        
        await logActivity({
          ownerId: authResult.dataOwnerId!,
          actorUid: decodedToken.uid,
          actorName: authResult.actorProfile?.fullName || authResult.actorProfile?.email || 'User',
          actionType: 'delete',
          entityType: 'Portfolio',
          entityId: portfolioId,
          entityName: authResult.portfolio.portfolioName
        });

        return NextResponse.json({ message: 'Portfolio deleted successfully' }, { status: 200 });
    } catch (error: any) {
        console.error(`API DELETE /api/portfolios/[portfolioId] error:`, error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
