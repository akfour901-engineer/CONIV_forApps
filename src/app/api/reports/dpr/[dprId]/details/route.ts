
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { Company, WorkOrder, DailyProgressReport, UserProfile, TeamMember } from '@/types';
export const dynamic = 'force-dynamic';
async function authorizeAndGetDprDetails(dprId: string, authenticatedUserUid: string) {
    const dprDocRef = adminDb.collection('dailyProgressReports').doc(dprId);
    const dprSnap = await dprDocRef.get();

    if (!dprSnap.exists) {
        return { authorized: false, error: 'DPR not found.', status: 404 };
    }
    const dprData = dprSnap.data() as DailyProgressReport;
    const itemOwnerId = dprData.userId;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;
    
    const dataOwnerIdForRequest = authUserProfile.ownerId || authenticatedUserUid;

    if (itemOwnerId !== dataOwnerIdForRequest) {
        return { authorized: false, error: 'Forbidden: This DPR does not belong to your current data scope.', status: 403 };
    }

    if (authenticatedUserUid === itemOwnerId) {
        return { authorized: true, dataOwnerId: itemOwnerId, dpr: dprData };
    }

    if (authUserProfile.ownerId && authUserProfile.ownerId === itemOwnerId) { 
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageDpr) {
                return { authorized: true, dataOwnerId: itemOwnerId, dpr: dprData };
            }
        }
    }
    return { authorized: false, error: 'Forbidden: You do not have permission.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { dprId: string } }) {
    const dprId = params.dprId;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;

        const authResult = await authorizeAndGetDprDetails(dprId, authenticatedUserUid);
        if (!authResult.authorized || !authResult.dpr || !authResult.dataOwnerId) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const { dpr } = authResult;
        
        const workOrderDoc = await adminDb.collection('workOrders').doc(dpr.workOrderId).get();
        if (!workOrderDoc.exists) {
            return NextResponse.json({ error: 'Associated Work Order not found.' }, { status: 404 });
        }
        const workOrderData = { id: workOrderDoc.id, ...workOrderDoc.data() } as WorkOrder;
        
        let companyData: Company | null = null;
        if (workOrderData.companyId) {
            const companyDoc = await adminDb.collection('companies').doc(workOrderData.companyId).get();
            if (companyDoc.exists) {
                companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
            }
        }

        return NextResponse.json({
            report: dpr,
            company: companyData,
            workOrder: workOrderData,
        }, { status: 200 });

    } catch (error: any) {
        console.error(`API Error fetching details for DPR ${dprId}:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
