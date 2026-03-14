import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { DailyProgressReport, DprConsumedItem, WorkOrder, UserProfile, TeamMember, Company, ServiceVisitReport } from '@/types/server-only';
import { parseISO, isValid } from '@/lib/utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const reportQuerySchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  startDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Invalid start date."}),
  endDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Invalid end date."}),
  workOrderId: z.string().optional(),
});

interface AggregatedItem {
    description: string;
    unit: string;
    totalQuantity: number;
    totalAmount: number;
    workOrderNumbers: string[];
}

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = reportQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { companyId, startDate, endDate, workOrderId } = validationResult.data;

    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    
    const dataOwnerId = (companyDoc.data() as Company).userId;
    
    let canAccess = false;
    if (authenticatedUserUid === dataOwnerId) {
      canAccess = true;
    } else {
      const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
      if (teamMemberDoc.exists && (teamMemberDoc.data() as TeamMember).permissions?.canViewFinancialSummaries) {
        canAccess = true;
      }
    }
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let workOrderIdsToQuery: string[] = [];
    if (workOrderId && workOrderId !== 'all') {
        workOrderIdsToQuery.push(workOrderId);
    } else {
        const companyWOsSnap = await adminDb.collection('workOrders').where('userId', '==', dataOwnerId).where('companyId', '==', companyId).get();
        if(!companyWOsSnap.empty) {
            workOrderIdsToQuery = companyWOsSnap.docs.map(doc => doc.id);
        }
    }

    if (workOrderIdsToQuery.length === 0) {
        return NextResponse.json([], { status: 200 }); // Return empty if no WOs match
    }

    // Firestore 'in' query is limited to 30 items per query.
    const MAX_IDS_PER_QUERY = 30;
    const workOrderIdChunks: string[][] = [];
    for (let i = 0; i < workOrderIdsToQuery.length; i += MAX_IDS_PER_QUERY) {
        workOrderIdChunks.push(workOrderIdsToQuery.slice(i, i + MAX_IDS_PER_QUERY));
    }
    
    const allDprs: DailyProgressReport[] = [];
    const allSvrs: ServiceVisitReport[] = [];
    
    for (const chunk of workOrderIdChunks) {
        if(chunk.length > 0) {
            const dprQuery = adminDb.collection('dailyProgressReports')
                .where('userId', '==', dataOwnerId)
                .where('workOrderId', 'in', chunk);
                
            const svrQuery = adminDb.collection('serviceVisitReports')
                .where('userId', '==', dataOwnerId)
                .where('workOrderId', 'in', chunk);

            const [dprSnapshot, svrSnapshot] = await Promise.all([dprQuery.get(), svrQuery.get()]);
            
            dprSnapshot.forEach(doc => {
                const report = doc.data() as DailyProgressReport;
                const reportDate = parseISO(report.reportDate);
                if (isValid(reportDate) && reportDate >= parseISO(startDate) && reportDate <= parseISO(endDate)) {
                    allDprs.push(report);
                }
            });

            svrSnapshot.forEach(doc => {
                const report = doc.data() as ServiceVisitReport;
                const reportDate = parseISO(report.visitDate);
                if (isValid(reportDate) && reportDate >= parseISO(startDate) && reportDate <= parseISO(endDate)) {
                    allSvrs.push(report);
                }
            });
        }
    }
    
    const aggregatedItems: { [key: string]: AggregatedItem } = {};

    const processItems = (report: DailyProgressReport | ServiceVisitReport) => {
      if (report.consumedItems && Array.isArray(report.consumedItems)) {
        for (const item of report.consumedItems) {
          const key = `${item.description.trim().toLowerCase()}|${item.unit.trim().toLowerCase()}`;
          if (!aggregatedItems[key]) {
            aggregatedItems[key] = {
              description: item.description,
              unit: item.unit,
              totalQuantity: 0,
              totalAmount: 0,
              workOrderNumbers: [],
            };
          }
          aggregatedItems[key].totalQuantity += item.consumedQuantity;
          aggregatedItems[key].totalAmount += item.amount;
          if (report.workOrderNumber && !aggregatedItems[key].workOrderNumbers.includes(report.workOrderNumber)) {
            aggregatedItems[key].workOrderNumbers.push(report.workOrderNumber);
          }
        }
      }
    };
    
    allDprs.forEach(processItems);
    allSvrs.forEach(processItems);

    return NextResponse.json(Object.values(aggregatedItems), { status: 200 });

  } catch (error: any) {
    console.error("API /reports/materials-consumption GET error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
