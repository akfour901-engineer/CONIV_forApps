import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { Company, WorkOrder, ServiceVisitReport, UserProfile, TeamMember } from '@/types';
export const dynamic = 'force-dynamic';
async function authorizeAndGetSvrDetails(svrId: string, authenticatedUserUid: string) {
    const svrDocRef = adminDb.collection('serviceVisitReports').doc(svrId);
    const svrSnap = await svrDocRef.get();

    if (!svrSnap.exists) {
        return { authorized: false, error: 'SVR not found.', status: 404 };
    }
    const svrData = svrSnap.data() as ServiceVisitReport;
    const itemOwnerId = svrData.userId;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;
    
    const dataOwnerIdForRequest = authUserProfile.ownerId || authenticatedUserUid;

    if (itemOwnerId !== dataOwnerIdForRequest) {
        return { authorized: false, error: 'Forbidden: This SVR does not belong to your current data scope.', status: 403 };
    }

    if (authenticatedUserUid === itemOwnerId) {
        return { authorized: true, dataOwnerId: itemOwnerId, svr: svrData };
    }

    if (authUserProfile.ownerId && authUserProfile.ownerId === itemOwnerId) { 
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageSvr) {
                return { authorized: true, dataOwnerId: itemOwnerId, svr: svrData };
            }
        }
    }
    return { authorized: false, error: 'Forbidden: You do not have permission.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { svrId: string } }) {
    const svrId = params.svrId;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;

        const authResult = await authorizeAndGetSvrDetails(svrId, authenticatedUserUid);
        if (!authResult.authorized || !authResult.svr || !authResult.dataOwnerId) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const { svr } = authResult;
        
        const workOrderDoc = await adminDb.collection('workOrders').doc(svr.workOrderId).get();
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
            report: svr,
            company: companyData,
            workOrder: workOrderData,
        }, { status: 200 });

    } catch (error: any) {
        console.error(`API Error fetching details for SVR ${svrId}:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
