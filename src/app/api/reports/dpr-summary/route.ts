import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { Company, DailyProgressReport, UserProfile, TeamMember } from '@/types/server-only';
import { parseISO, isValid } from '@/lib/utils';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const reportQuerySchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  startDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Invalid start date."}),
  endDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Invalid end date."}),
  workOrderId: z.string().optional(),
});

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === requestedDataOwnerId) return true;
  const adminDb = getDb();
  const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (memberProfileDoc.exists) {
    const memberProfile = memberProfileDoc.data() as UserProfile;
    if (memberProfile.ownerId === requestedDataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        return (teamMemberDocSnap.data() as TeamMember).permissions?.canManageDpr || false;
      }
    }
  }
  return false;
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
    const { workOrderId, companyId, startDate, endDate } = validationResult.data;

    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
       return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
    const dataOwnerId = companyData.userId;

    const hasPermission = await checkPermissions(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let workOrderIdsToFilter: string[] = [];
    if (workOrderId && workOrderId !== 'all') {
      workOrderIdsToFilter.push(workOrderId);
    } else {
        const companyWOsSnap = await adminDb.collection('workOrders').where('userId', '==', dataOwnerId).where('companyId', '==', companyId).get();
        if(!companyWOsSnap.empty) {
            workOrderIdsToFilter = companyWOsSnap.docs.map(doc => doc.id);
        }
    }

    let finalReportData: DailyProgressReport[] = [];

    if (workOrderIdsToFilter.length > 0) {
        // Firestore 'in' query is limited to 30 items per query.
        const MAX_IDS_PER_QUERY = 30;
        const workOrderIdChunks: string[][] = [];
        for (let i = 0; i < workOrderIdsToFilter.length; i += MAX_IDS_PER_QUERY) {
            workOrderIdChunks.push(workOrderIdsToFilter.slice(i, i + MAX_IDS_PER_QUERY));
        }
        
        for (const chunk of workOrderIdChunks) {
            if(chunk.length > 0) {
                const dprQuery = adminDb.collection('dailyProgressReports')
                    .where('userId', '==', dataOwnerId)
                    .where('workOrderId', 'in', chunk);
                    
                const dprSnapshot = await dprQuery.get();
                
                dprSnapshot.forEach(doc => {
                    const report = doc.data() as DailyProgressReport;
                    const reportDate = parseISO(report.reportDate);
                    if (isValid(reportDate) && reportDate >= parseISO(startDate) && reportDate <= parseISO(endDate)) {
                        finalReportData.push({ id: doc.id, ...report });
                    }
                });
            }
        }
    }

    finalReportData.sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());

    return NextResponse.json({ company: companyData, reportData: finalReportData }, { status: 200 });

  } catch (error: any) {
    console.error("API /reports/dpr-summary GET error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}