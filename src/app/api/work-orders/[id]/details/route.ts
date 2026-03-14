import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { WorkOrder, Invoice as AppInvoice, LabourRegister, Document as AppDocument, TeamMember, UserProfile, ServiceVisitReport, DailyProgressReport, PurchaseOrder, Expense } from '@/types';
export const dynamic = 'force-dynamic';
async function authorizeAndGetWorkOrder(workOrderId: string, authenticatedUserUid: string) {
    const woDocRef = adminDb.collection('workOrders').doc(workOrderId);
    const woSnap = await woDocRef.get();

    if (!woSnap.exists) {
        return { authorized: false, error: 'Work Order not found.', status: 404 };
    }

    const workOrderData = { id: woSnap.id, ...woSnap.data() } as WorkOrder;
    const itemOwnerId = workOrderData.userId;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    // Determine the data scope the requesting user is operating in.
    const dataOwnerIdForRequest = authUserProfile.ownerId || authenticatedUserUid;

    // CRITICAL CHECK: The work order must belong to the team/account the user is currently managing.
    if (itemOwnerId !== dataOwnerIdForRequest) {
        return { authorized: false, error: 'Forbidden: This Work Order does not belong to your current data scope.', status: 403 };
    }

    // Now, check if the user has permission within that scope.
    // Case 1: The user requesting the data is the direct owner of the work order.
    if (authenticatedUserUid === itemOwnerId) {
        return { authorized: true, workOrder: workOrderData, dataOwnerId: itemOwnerId };
    }

    // Case 2: The user is a team member. Check if they have the 'canViewWorkOrders' permission.
    if (authUserProfile.ownerId && authUserProfile.ownerId === itemOwnerId) { 
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            // Grant access only if the team member has permission to view work orders.
            if (teamMemberData.permissions?.canViewWorkOrders) {
                return { authorized: true, workOrder: workOrderData, dataOwnerId: itemOwnerId };
            }
        }
    }

    // If neither case is met, deny access.
    return { authorized: false, error: 'Forbidden: You do not have permission to view this work order.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { id: string } }) {
    const workOrderId = params.id;

    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;

        const authResult = await authorizeAndGetWorkOrder(workOrderId, authenticatedUserUid);
        if (!authResult.authorized || !authResult.workOrder || !authResult.dataOwnerId) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const { workOrder, dataOwnerId } = authResult;

        const [invoicesSnap, labourSnap, documentsSnap, dprSnap, svrSnap, poSnap, expensesSnap] = await Promise.all([
            adminDb.collection('invoices').where("userId", "==", dataOwnerId).where("workOrderId", "==", workOrderId).get(),
            adminDb.collection('labourRegisters').where("userId", "==", dataOwnerId).where("workOrderId", "==", workOrderId).get(),
            adminDb.collection('documents').where("userId", "==", dataOwnerId).where("workOrderId", "==", workOrderId).get(),
            adminDb.collection('dailyProgressReports').where("userId", "==", dataOwnerId).where("workOrderId", "==", workOrderId).get(),
            adminDb.collection('serviceVisitReports').where("userId", "==", dataOwnerId).where("workOrderId", "==", workOrderId).get(),
            adminDb.collection('purchaseOrders').where("userId", "==", dataOwnerId).where("workOrderId", "==", workOrderId).get(),
            adminDb.collection('expenses').where("userId", "==", dataOwnerId).where("workOrderId", "==", workOrderId).get()
        ]);
        
        const linkedInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppInvoice)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const linkedLabour = labourSnap.docs.map(d => ({ id: d.id, ...d.data() } as LabourRegister)).sort((a, b) => a.workerName.localeCompare(b.workerName));
        const linkedDocuments = documentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppDocument)).sort((a, b) => new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime());
        const linkedDprs = dprSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyProgressReport)).sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
        const linkedSvrs = svrSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceVisitReport)).sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
        const linkedPurchaseOrders = poSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const linkedExpenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({
            workOrder,
            linkedInvoices,
            linkedLabour,
            linkedDocuments,
            linkedDprs,
            linkedSvrs,
            linkedPurchaseOrders,
            linkedExpenses,
        }, { status: 200 });

    } catch (error: any) {
        console.error(`API Error fetching details for WO ${workOrderId}:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
