
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { Company, WorkOrder, LabourRegister, LabourTimeLog, LabourAdvance, UserProfile, TeamMember } from '@/types';
import { format as formatTZ, toDate } from 'date-fns-tz';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import type { Query } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

interface ProcessedLabourData {
  id?: string;
  workerName: string;
  role: string;
  workOrderNumber: string;
  dailyWage: number;
  daysPresent: number;
  totalHours: number;
  totalEarned: number;
  totalAdvancesPaid: number;
  netPayable: number;
}

const reportQuerySchema = z.object({
  companyId: z.string().min(1),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  workOrderId: z.string().optional(), // 'all' or specific ID
});

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
    const { companyId, month, year, workOrderId } = validationResult.data;

    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
    const dataOwnerId = companyData.userId;

    let canAccess = false;
    if (authenticatedUserUid === dataOwnerId) canAccess = true;
    else {
      const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
      if (teamMemberDoc.exists && ((teamMemberDoc.data() as TeamMember).permissions?.canManageLabourRegister || (teamMemberDoc.data() as TeamMember).permissions?.canViewFinancialSummaries)) {
        canAccess = true;
      }
    }
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let selectedWorkOrderDetails: WorkOrder | null = null;
    if (workOrderId && workOrderId !== 'all') {
      const woDoc = await adminDb.collection('workOrders').doc(workOrderId).get();
      if (woDoc.exists && woDoc.data()?.userId === dataOwnerId) {
        selectedWorkOrderDetails = { id: woDoc.id, ...woDoc.data() } as WorkOrder;
      }
    }

    let labourQuery: Query = adminDb.collection('labourRegisters')
      .where("userId", "==", dataOwnerId)
      .where("companyId", "==", companyId);
    if (workOrderId && workOrderId !== 'all') {
      labourQuery = labourQuery.where("workOrderId", "==", workOrderId);
    }
    const labourSnapshot = await labourQuery.get();
    const labourers = labourSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabourRegister));

    if (labourers.length === 0) {
        return NextResponse.json({ company: companyData, workOrder: selectedWorkOrderDetails, reportData: [] }, { status: 200 });
    }
    
    const monthStartDate = startOfMonth(new Date(year, month - 1, 1));
    const monthEndDate = endOfMonth(new Date(year, month - 1, 1));
    const formattedStartDate = formatTZ(monthStartDate, 'yyyy-MM-dd');
    const formattedEndDate = formatTZ(monthEndDate, 'yyyy-MM-dd');
    
    const attendanceByLabourer: { [key: string]: LabourTimeLog[] } = {};
    const advancesByLabourer: { [key: string]: LabourAdvance[] } = {};

    const dataFetchPromises = labourers.map(async (labourer) => {
      const labourerId = labourer.id!;
      
      const attendanceQuery = adminDb.collection('labourTimeLogs').where('labourRegisterId', '==', labourerId);
      const advancesQuery = adminDb.collection('labourAdvances').where('labourRegisterId', '==', labourerId);

      const [attendanceSnapshot, advancesSnapshot] = await Promise.all([
        attendanceQuery.get(),
        advancesQuery.get()
      ]);
      
      const allAttendance = attendanceSnapshot.docs.map(doc => doc.data() as LabourTimeLog);
      const filteredAttendance = allAttendance.filter(log => log.date >= formattedStartDate && log.date <= formattedEndDate);
      attendanceByLabourer[labourerId] = filteredAttendance;
      
      const allAdvances = advancesSnapshot.docs.map(doc => doc.data() as LabourAdvance);
      const filteredAdvances = allAdvances.filter(adv => adv.date >= formattedStartDate && adv.date <= formattedEndDate);
      advancesByLabourer[labourerId] = filteredAdvances;
    });

    await Promise.all(dataFetchPromises);
    
    const reportData: ProcessedLabourData[] = labourers.map(lab => {
      const attendanceRecords = attendanceByLabourer[lab.id!] || [];
      const advancesRecords = advancesByLabourer[lab.id!] || [];
      
      const presentDates = new Set(attendanceRecords.filter(log => (log.hoursWorked ?? 0) > 0).map(a => a.date));
      const daysPresent = presentDates.size;
      const totalHours = attendanceRecords.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
      const totalAdvancesPaid = advancesRecords.reduce((sum, adv) => sum + adv.amount, 0);
      
      // Real-time calculation based on this month's attendance
      const totalEarned = daysPresent * lab.dailyWage;
      const netPayable = totalEarned - totalAdvancesPaid;

      return { ...lab, daysPresent, totalHours, totalEarned, totalAdvancesPaid, netPayable };
    }).sort((a,b) => a.workerName.localeCompare(b.workerName));

    return NextResponse.json({ company: companyData, workOrder: selectedWorkOrderDetails, reportData }, { status: 200 });

  } catch (error: any) {
    console.error("API /reports/labour-summary GET error:", error);
    const errorMessage = error.code === 9 ? `The query requires an index. Please check server logs for a link to create it.` : error.message;
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
}
