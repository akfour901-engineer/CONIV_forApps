
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, Estimate, WorkOrder, Expense, PurchaseOrder, LabourAdvance } from '@/types';

export const dynamic = 'force-dynamic';

export interface EstimateVsActualsData {
  estimateId: string;
  estimateNumber: string;
  workOrderId?: string;
  workOrderNumber?: string;
  organizationName: string;
  estimatedAmount: number;
  actualCost: number;
  variance: number;
  variancePercentage: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
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
  const functionCallId = `api_estimate_vs_actuals_GET_${Date.now()}`;
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
    
    const [estimatesSnap, workOrdersSnap, expensesSnap, poSnap, labourAdvancesSnap] = await Promise.all([
        adminDb.collection('estimates').where('userId', '==', requestedDataOwnerId).where('status', '==', 'approved').get(),
        adminDb.collection('workOrders').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('expenses').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('purchaseOrders').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('labourAdvances').where('userId', '==', requestedDataOwnerId).get(),
    ]);
    
    const workOrders = workOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
    const workOrdersByEstimateId = new Map(workOrders.filter(wo => wo.estimateId).map(wo => [wo.estimateId, wo]));

    const expensesByWo: Map<string, number> = new Map();
    expensesSnap.forEach(doc => {
        const exp = doc.data() as Expense;
        if(exp.workOrderId) {
            expensesByWo.set(exp.workOrderId, (expensesByWo.get(exp.workOrderId) || 0) + exp.amount);
        }
    });
    
    const poCostByWo: Map<string, number> = new Map();
    poSnap.forEach(doc => {
        const po = doc.data() as PurchaseOrder;
        if (po.workOrderId && po.status !== 'cancelled') {
            poCostByWo.set(po.workOrderId, (poCostByWo.get(po.workOrderId) || 0) + po.grandTotal);
        }
    });

    const labourCostByWo: Map<string, number> = new Map();
    labourAdvancesSnap.forEach(doc => {
        const adv = doc.data() as LabourAdvance;
        if(adv.workOrderId) {
            labourCostByWo.set(adv.workOrderId, (labourCostByWo.get(adv.workOrderId) || 0) + adv.amount);
        }
    });

    const analysisData: EstimateVsActualsData[] = estimatesSnap.docs.map(doc => {
        const estimate = { id: doc.id, ...doc.data() } as Estimate;
        const workOrder = workOrdersByEstimateId.get(estimate.id!);
        
        let actualCost = 0;
        let status: EstimateVsActualsData['status'] = 'Not Started';

        if(workOrder) {
            const woId = workOrder.id!;
            actualCost = (expensesByWo.get(woId) || 0) + (poCostByWo.get(woId) || 0) + (labourCostByWo.get(woId) || 0);
            if(workOrder.status === 'completed') {
                status = 'Completed';
            } else if (workOrder.status !== 'draft' && workOrder.status !== 'pending' && workOrder.status !== 'cancelled') {
                status = 'In Progress';
            }
        }
        
        const estimatedAmount = estimate.grandTotal;
        const variance = estimatedAmount - actualCost;
        const variancePercentage = estimatedAmount > 0 ? (variance / estimatedAmount) * 100 : 0;
        
        return {
            estimateId: estimate.id!,
            estimateNumber: estimate.estimateNumber,
            workOrderId: workOrder?.id,
            workOrderNumber: workOrder?.workOrderNumber,
            organizationName: estimate.organizationName,
            estimatedAmount,
            actualCost,
            variance,
            variancePercentage,
            status,
        };
    });

    return NextResponse.json(analysisData, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/reports/estimate-vs-actuals:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
