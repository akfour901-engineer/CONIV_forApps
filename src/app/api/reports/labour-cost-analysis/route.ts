

import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, WorkOrder, LabourRegister } from '@/types';

export const dynamic = 'force-dynamic';

export interface LabourCostAnalysisItem {
  workOrderId: string;
  workOrderNumber: string;
  organizationName: string;
  projectBudget: number; // The grandTotal of the Work Order
  actualLabourCost: number;
  variance: number;
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
  const functionCallId = `api_labour_cost_analysis_GET_${Date.now()}`;
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
    
    const [workOrdersSnap, labourRegistersSnap] = await Promise.all([
        adminDb.collection('workOrders').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('labourRegisters').where('userId', '==', requestedDataOwnerId).get(),
    ]);
    
    const workOrders: WorkOrder[] = [];
    workOrdersSnap.forEach(doc => workOrders.push({ id: doc.id, ...doc.data() } as WorkOrder));
    
    const labourDataByWo: { [key: string]: number } = {};
    labourRegistersSnap.forEach(doc => {
        const labourEntry = doc.data() as LabourRegister;
        // Use totalAmount which is the calculated total earned, not just advances paid
        const totalEarned = labourEntry.totalAmount || 0; 
        labourDataByWo[labourEntry.workOrderId] = (labourDataByWo[labourEntry.workOrderId] || 0) + totalEarned;
    });

    const analysisData: LabourCostAnalysisItem[] = workOrders.map(wo => {
        const actualLabourCost = labourDataByWo[wo.id!] || 0;
        const projectBudget = wo.grandTotal;
        const variance = projectBudget - actualLabourCost;
        return {
            workOrderId: wo.id!,
            workOrderNumber: wo.workOrderNumber,
            organizationName: wo.organizationName,
            projectBudget,
            actualLabourCost,
            variance,
        };
    });

    return NextResponse.json(analysisData, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/reports/labour-cost-analysis:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
