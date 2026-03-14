
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, WorkOrder, Invoice, Expense, AdvancedReportingData, Estimate, InventoryItem, WorkOrderProfitLoss, YearlyFinancialSummary, PurchaseOrder, LabourAdvance } from '@/types/server-only';
import { ESTIMATE_STATUS_OPTIONS, INVOICE_STATUS_OPTIONS, WORK_ORDER_STATUS_OPTIONS } from '@/types/server-only';
import { parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<{ authorized: boolean; error?: NextResponse }> {
    const adminDb = getDb();
    if (authenticatedUserUid === requestedDataOwnerId) {
        return { authorized: true }; // Owner can view their own data
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

const calculateInventoryValue = (items: InventoryItem[]): number => {
  let totalValue = 0;
  for (const item of items) {
    const value = (item.purchasePrice || 0) * (item.quantityOnHand || 0);
    totalValue += value;
  }
  return totalValue;
};


export async function GET(request: Request) {
  const functionCallId = `api_advanced_reporting_GET_${Date.now()}`;
  const authAdmin = getAuth();
  const adminDb = getDb();

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
    
    const [estimatesSnap, workOrdersSnap, invoicesSnap, expensesSnap, inventorySnap, purchaseOrdersSnap, labourAdvancesSnap] = await Promise.all([
        adminDb.collection('estimates').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('workOrders').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('invoices').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('expenses').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('inventoryItems').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('purchaseOrders').where('userId', '==', requestedDataOwnerId).get(),
        adminDb.collection('labourAdvances').where('userId', '==', requestedDataOwnerId).get(),
    ]);
    
    const estimates: Estimate[] = [];
    estimatesSnap.forEach(doc => estimates.push(doc.data() as Estimate));

    const workOrders: WorkOrder[] = [];
    workOrdersSnap.forEach(doc => workOrders.push({ id: doc.id, ...doc.data() } as WorkOrder));
    
    const invoices: Invoice[] = [];
    invoicesSnap.forEach(doc => invoices.push(doc.data() as Invoice));

    const expenses: Expense[] = [];
    expensesSnap.forEach(doc => expenses.push({ id: doc.id, ...doc.data() } as Expense));
    
    const inventoryItems: InventoryItem[] = [];
    inventorySnap.forEach(doc => inventoryItems.push(doc.data() as InventoryItem));

    const purchaseOrders: PurchaseOrder[] = [];
    purchaseOrdersSnap.forEach(doc => purchaseOrders.push({ id: doc.id, ...doc.data() } as PurchaseOrder));

    const labourAdvances: LabourAdvance[] = [];
    labourAdvancesSnap.forEach(doc => labourAdvances.push(doc.data() as LabourAdvance));


    // Process Estimates
    const estSummary = ESTIMATE_STATUS_OPTIONS.reduce((acc, status) => ({...acc, [status]: {count: 0, totalValue: 0}}), {} as any);
    for(const est of estimates) {
        if (est.status && estSummary[est.status]) { 
            estSummary[est.status].count++; 
            estSummary[est.status].totalValue += est.grandTotal || 0; 
        }
    }
    const estimatesData: { name: string; count: number, totalValue: number }[] = [];
    for (const status of ESTIMATE_STATUS_OPTIONS) {
        estimatesData.push({ name: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), ...estSummary[status] });
    }

    // Process Work Orders
    const woSummary = WORK_ORDER_STATUS_OPTIONS.reduce((acc, status) => ({...acc, [status]: {count: 0, totalValue: 0}}), {} as any);
    for(const wo of workOrders) {
        if (wo.status && woSummary[wo.status]) { 
            woSummary[wo.status].count++; 
            woSummary[wo.status].totalValue += wo.grandTotal || 0; 
        }
    }
    const workOrdersData: { name: string; count: number, totalValue: number }[] = [];
    for (const status of WORK_ORDER_STATUS_OPTIONS) {
        workOrdersData.push({ name: status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), ...woSummary[status] });
    }
    
    // Process Invoices
    const invSummary = INVOICE_STATUS_OPTIONS.reduce((acc, status) => ({...acc, [status]: {count: 0, totalValue: 0, balanceDue: 0}}), {} as any);
    for(const inv of invoices) {
        if (inv.status && invSummary[inv.status]) { 
            invSummary[inv.status].count++; 
            invSummary[inv.status].totalValue += inv.grandTotal || 0; 
            invSummary[inv.status].balanceDue += inv.balanceDue || 0; 
        }
    }
    const invoicesData: { name: string; count: number, totalValue: number, balanceDue: number }[] = [];
    for (const status of INVOICE_STATUS_OPTIONS) {
        invoicesData.push({ name: status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), ...invSummary[status] });
    }

    let overallRevenue = 0;
    let overallExpenses = 0;
    const yearlyData: { [year: number]: { revenue: number, expenses: number } } = {};
    const financialsByMonth: { [key: string]: { income: number, expenses: number } } = {};
    const expenseCatSummary: { [category: string]: number } = {};
    const allDates: Date[] = [];

    for (const inv of invoices) {
      if (inv.status === 'paid') {
        const revenue = (inv.grandTotal || 0);
        overallRevenue += revenue;
        try {
            const invDate = parseISO(inv.date);
            const year = invDate.getFullYear();
            if (!yearlyData[year]) yearlyData[year] = { revenue: 0, expenses: 0 };
            yearlyData[year].revenue += revenue;

            const monthYear = format(invDate, 'yyyy-MM');
            allDates.push(invDate);
            if (!financialsByMonth[monthYear]) {
              financialsByMonth[monthYear] = { income: 0, expenses: 0 };
            }
            financialsByMonth[monthYear].income += (inv.grandTotal || 0) - (inv.balanceDue || 0);
        } catch(e) { console.warn(`Could not parse date for invoice ${inv.invoiceNumber}: ${inv.date}`); }
      }
    }
    
    for(const exp of expenses) {
      overallExpenses += exp.amount;
      try {
        const expDate = parseISO(exp.date);
        const year = expDate.getFullYear();
        if (!yearlyData[year]) yearlyData[year] = { revenue: 0, expenses: 0 };
        yearlyData[year].expenses += exp.amount;

        const monthYear = format(expDate, 'yyyy-MM');
        allDates.push(expDate);
        if (!financialsByMonth[monthYear]) {
          financialsByMonth[monthYear] = { income: 0, expenses: 0 };
        }
        financialsByMonth[monthYear].expenses += exp.amount || 0;
      } catch(e) { console.warn(`Could not parse date for expense ${exp.description}: ${exp.date}`); }

      const category = exp.category || "Uncategorized";
      expenseCatSummary[category] = (expenseCatSummary[category] || 0) + (exp.amount || 0);
    }
    
    // Also include POs not linked to a WO in overall expenses
    const miscPoTotal = purchaseOrders
        .filter(po => !po.workOrderId && po.status !== 'cancelled')
        .reduce((sum, po) => sum + po.grandTotal, 0);
    overallExpenses += miscPoTotal;


    const totalInventoryValue = calculateInventoryValue(inventoryItems);

    let monthlyFinancials: AdvancedReportingData['monthlyFinancials'] = [];
    if (allDates.length > 0) {
        const minDate = new Date(Math.min.apply(null, allDates.map(date => date.getTime())));
        const maxDate = new Date(Math.max.apply(null, allDates.map(date => date.getTime())));
        const intervalMonths = eachMonthOfInterval({ start: startOfMonth(minDate), end: endOfMonth(maxDate) });
        
        for (const monthDate of intervalMonths) {
            const monthYearKey = format(monthDate, 'yyyy-MM');
            monthlyFinancials.push({ month: monthYearKey, income: financialsByMonth[monthYearKey]?.income || 0, expenses: financialsByMonth[monthYearKey]?.expenses || 0 });
        }
    }
    
    const expenseCategoriesData: { name: string; value: number; }[] = [];
    for (const name in expenseCatSummary) {
        expenseCategoriesData.push({ name, value: expenseCatSummary[name] });
    }
    expenseCategoriesData.sort((a,b) => b.value - a.value);

    const yearlySummary: YearlyFinancialSummary[] = [];
    for (const yearStr in yearlyData) {
        const year = parseInt(yearStr, 10);
        yearlySummary.push({ year, revenue: yearlyData[year].revenue, expenses: yearlyData[year].expenses, profitLoss: yearlyData[year].revenue - yearlyData[year].expenses });
    }
    yearlySummary.sort((a, b) => b.year - a.year); 

    const workOrderDataMap: { [key: string]: { totalRevenue: number; totalExpenses: number; totalPoCost: number; totalLabourCost: number; workOrderNumber: string } } = {};
    const miscExpenses: Expense[] = [];

    for (const wo of workOrders) {
      if(wo.id) {
        workOrderDataMap[wo.id] = {
          totalRevenue: 0,
          totalExpenses: 0,
          totalPoCost: 0,
          totalLabourCost: 0,
          workOrderNumber: wo.workOrderNumber,
        };
      }
    }

    for (const inv of invoices) {
      if (inv.status === 'paid' && inv.workOrderId && workOrderDataMap[inv.workOrderId]) {
        const revenue = (inv.grandTotal || 0);
        workOrderDataMap[inv.workOrderId].totalRevenue += revenue;
      }
    }

    for (const exp of expenses) {
      if (exp.workOrderId && workOrderDataMap[exp.workOrderId]) {
        workOrderDataMap[exp.workOrderId].totalExpenses += exp.amount;
      } else {
        miscExpenses.push(exp);
      }
    }
    
    for (const po of purchaseOrders) {
        if (po.workOrderId && po.status !== 'cancelled' && workOrderDataMap[po.workOrderId]) {
            workOrderDataMap[po.workOrderId].totalPoCost += po.grandTotal;
        }
    }

    for (const adv of labourAdvances) {
      if(adv.workOrderId && workOrderDataMap[adv.workOrderId]) {
        workOrderDataMap[adv.workOrderId].totalLabourCost += adv.amount;
      }
    }


    const workOrderBreakdown: WorkOrderProfitLoss[] = [];
    for (const workOrderId in workOrderDataMap) {
        const data = workOrderDataMap[workOrderId];
        const totalCost = data.totalExpenses + data.totalPoCost + data.totalLabourCost;
        workOrderBreakdown.push({
            workOrderId,
            workOrderNumber: data.workOrderNumber,
            totalRevenue: data.totalRevenue,
            totalExpenses: totalCost,
            profitLoss: data.totalRevenue - totalCost,
        });
    }

    const reportingData: AdvancedReportingData = {
        estimatesData,
        workOrdersData,
        invoicesData,
        monthlyFinancials: monthlyFinancials ?? [],
        expenseCategoriesData: expenseCategoriesData ?? [],
        overallProfitLoss: overallRevenue - overallExpenses,
        totalRevenue: overallRevenue,
        totalExpenses: overallExpenses,
        totalInventoryValue,
        workOrderBreakdown,
        miscExpenses,
        yearlySummary,
    };

    return NextResponse.json(reportingData, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/dashboard/financial-summary:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
