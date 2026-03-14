
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { Company, WorkOrder, DailyProgressReport, UserProfile, TeamMember } from '@/types/server-only';
import { parseISO, isValid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const reportQuerySchema = z.object({
  workOrderId: z.string().min(1, "Work Order ID is required."),
  startDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Invalid start date."}),
  endDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Invalid end date."}),
});

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = reportQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { workOrderId, startDate, endDate } = validationResult.data;

    // Fetch the specific Work Order to get companyId and verify ownership
    const woDoc = await adminDb.collection('workOrders').doc(workOrderId).get();
    if (!woDoc.exists) {
       return NextResponse.json({ error: 'Work Order not found' }, { status: 404 });
    }
    const workOrderData = { id: woDoc.id, ...woDoc.data() } as WorkOrder;
    const dataOwnerId = workOrderData.userId;

    // Authorization check
    let canAccess = false;
    if (authenticatedUserUid === dataOwnerId) canAccess = true;
    else {
      const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
      if (teamMemberDoc.exists && (teamMemberDoc.data() as TeamMember).permissions?.canManageDpr) {
        canAccess = true;
      }
    }
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch the company details
    let companyData: Company | null = null;
    if (workOrderData.companyId) {
        const companyDoc = await adminDb.collection('companies').doc(workOrderData.companyId).get();
        if (companyDoc.exists) {
            companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
        }
    }
    
    // Fetch and filter DPRs for the given work order and date range
    const dprQuery = adminDb.collection('dailyProgressReports')
        .where("userId", "==", dataOwnerId)
        .where("workOrderId", "==", workOrderId);
        
    const dprSnapshot = await dprQuery.get();

    const allReportsForWO = dprSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyProgressReport));

    const startDateObj = parseISO(startDate);
    const endDateObj = parseISO(endDate);

    const reports = allReportsForWO
      .filter(report => {
        try {
          const reportDate = parseISO(report.reportDate);
          return reportDate >= startDateObj && reportDate <= endDateObj;
        } catch (e) {
          console.warn(`Invalid date format for DPR ${report.id}`);
          return false;
        }
      })
      .sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());

    return NextResponse.json({ company: companyData, workOrder: workOrderData, reportData: reports }, { status: 200 });

  } catch (error: any) {
    console.error("API /reports/dpr-summary GET error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

