
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, WorkOrder, Invoice as AppInvoice, Expense, PurchaseOrder, LabourAdvance } from '@/types';

export const dynamic = 'force-dynamic';

export interface WorkOrderProfitabilityItem {
  workOrderId: string;
  workOrderNumber: string;
  organizationName: string;
  projectValue: number;
  totalRevenue: number;
  totalExpenses: number;
  totalPurchaseOrders: number;
  totalLabourCost: number;
  totalCost: number;
  profitLoss: number;
  status: WorkOrder['status'];
}

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<{ authorized: boolean; error?: NextResponse }> {
    const adminDb = getDb();
    if (authenticatedUserUid === requestedDataOwnerId) {
        return { authorized: true };
    }

    const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!memberProfileDoc.exists) {
        return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 }) };
    }
    const memberProfile = memberProfileDoc.data() as UserProfile;

    if (memberProfile.ownerId === requestedDataOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canViewFinancialSummaries) {
                return { authorized: true };
            }
        }
    }
    
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Not authorized to view financial summaries.' }, { status: 403 }) };
}


export async function GET(request: Request) {
  const functionCallId = `api_wo_profitability_GET_${Date.now()}`;
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
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');

    if (!requestedDataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId query parameter is required' }, { status: 400 });
    }

    const authCheck = await checkPermissions(authenticatedUserUid, requestedDataOwnerId);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }
    
    const [workOrdersSnap, invoicesSnap, expensesSnap, poSnap, labourAdvancesSnap] = await Promise.all([
        adminDb.collection('workOrders').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('invoices').where('userId', '==', requestedDataOwnerId).where('status', 'in', ['paid', 'partially-paid']).get(),
        adminDb.collection('expenses').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('purchaseOrders').where('userId', '==', requestedDataOwnerId).where('status', 'in', ['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'billed']).get(),
        adminDb.collection('labourAdvances').where('userId', '==', requestedDataOwnerId).get(),
    ]);
    
    const workOrders = workOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
    
    const revenueByWo: { [key: string]: number } = {};
    invoicesSnap.forEach(doc => {
      const inv = doc.data() as AppInvoice;
      if (inv.workOrderId) {
        revenueByWo[inv.workOrderId] = (revenueByWo[inv.workOrderId] || 0) + (inv.grandTotal - inv.balanceDue);
      }
    });

    const expensesByWo: { [key: string]: number } = {};
    expensesSnap.forEach(doc => {
      const exp = doc.data() as Expense;
      if (exp.workOrderId) {
        expensesByWo[exp.workOrderId] = (expensesByWo[exp.workOrderId] || 0) + exp.amount;
      }
    });
    
    const poCostByWo: { [key: string]: number } = {};
    poSnap.forEach(doc => {
        const po = doc.data() as PurchaseOrder;
        if (po.workOrderId) {
            poCostByWo[po.workOrderId] = (poCostByWo[po.workOrderId] || 0) + po.grandTotal;
        }
    });

    const labourCostByWo: { [key: string]: number } = {};
    labourAdvancesSnap.forEach(doc => {
        const adv = doc.data() as LabourAdvance;
        if(adv.workOrderId) {
            labourCostByWo[adv.workOrderId] = (labourCostByWo[adv.workOrderId] || 0) + adv.amount;
        }
    });

    const analysisData: WorkOrderProfitabilityItem[] = workOrders.map(wo => {
        const totalRevenue = revenueByWo[wo.id!] || 0;
        const totalExpenses = expensesByWo[wo.id!] || 0;
        const totalPurchaseOrders = poCostByWo[wo.id!] || 0;
        const totalLabourCost = labourCostByWo[wo.id!] || 0;
        const totalCost = totalExpenses + totalPurchaseOrders + totalLabourCost;
        const profitLoss = totalRevenue - totalCost;

        return {
            workOrderId: wo.id!,
            workOrderNumber: wo.workOrderNumber,
            organizationName: wo.organizationName,
            projectValue: wo.grandTotal,
            totalRevenue,
            totalExpenses,
            totalPurchaseOrders,
            totalLabourCost,
            totalCost,
            profitLoss,
            status: wo.status,
        };
    });

    return NextResponse.json(analysisData, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/reports/work-order-profitability:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
