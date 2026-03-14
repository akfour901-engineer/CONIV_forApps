import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init'; // Removed to prevent errors
import type { SummaryData, UserProfile, TeamMember, Estimate, WorkOrder, Invoice, Company, Organization, LabourRegister, SorRate, License, InventoryItem, FollowUp, DailyProgressReport, ServiceVisitReport } from '@/types/server-only';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const functionCallId = `api_dashboard_summary_GET_${Date.now()}`;
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

    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true;
    } else {
      const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if (authUserProfileDoc.exists && authUserProfileDoc.data()?.ownerId === requestedDataOwnerId) {
        canAccess = true; // Any team member can see their owner's dashboard stats for now
      }
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden: Not authorized to view this dashboard data.', code: 'FORBIDDEN_SUMMARY_ACCESS'}, { status: 403 });
    }
    
    const dataOwnerIdForQuery = requestedDataOwnerId;

    const [
      estimatesSnap,
      workOrdersSnap,
      invoicesSnap,
      companiesSnap,
      organizationsSnap,
      labourSnap,
      sorSnap,
      licensesSnap,
      inventorySnap,
      followUpsSnap,
      dprSnap,
      svrSnap,
    ] = await Promise.all([
      adminDb.collection('estimates').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('workOrders').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('invoices').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('companies').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('organizations').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('labourRegisters').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('sorRates').where('userId', '==', dataOwnerIdForQuery).where('visibility', '==', 'private').get(),
      adminDb.collection('licenses').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('inventoryItems').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('followUps').where('userId', '==', dataOwnerIdForQuery).where('status', '==', 'pending').get(),
      adminDb.collection('dailyProgressReports').where('userId', '==', dataOwnerIdForQuery).get(),
      adminDb.collection('serviceVisitReports').where('userId', '==', dataOwnerIdForQuery).get(),
    ]);

    // Process Invoices
    const paidInvoices = invoicesSnap.docs.filter(doc => doc.data().status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, doc) => sum + doc.data().grandTotal, 0);
    const outstandingInvoices = invoicesSnap.docs.filter(doc => ['unpaid', 'overdue', 'partially-paid'].includes(doc.data().status));
    const totalReceivables = outstandingInvoices.reduce((sum, doc) => sum + doc.data().balanceDue, 0);
    
    // Process Work Orders
    const ongoingWorkOrders = workOrdersSnap.docs.filter(doc => doc.data().status === 'in-progress');

    // Process Estimates
    const pendingEstimates = estimatesSnap.docs.filter(doc => doc.data().status === 'submitted');

    const summary: SummaryData = {
      totalRevenue: {
        title: "Total Revenue",
        value: totalRevenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }),
        iconName: "TrendingUp",
        href: "/dashboard/financial-summary",
        description: "From all paid invoices.",
      },
      totalReceivables: {
        title: "Total Receivables",
        value: totalReceivables.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }),
        iconName: "TrendingDown", // Changed to down to imply something to recover
        href: "/dashboard/invoices",
        description: "From unpaid & overdue invoices.",
      },
      ongoingProjects: {
        title: "Ongoing Projects",
        value: ongoingWorkOrders.length.toString(),
        iconName: "ClipboardList",
        href: "/dashboard/work-orders",
        description: "Work orders currently 'in-progress'."
      },
      pendingEstimates: {
        title: "Pending Estimates",
        value: pendingEstimates.length.toString(),
        iconName: "FileText",
        href: "/dashboard/estimates",
        description: "Estimates 'submitted' to clients."
      },
      companies: {
        title: "Companies",
        value: companiesSnap.size.toString(),
        iconName: "Building2",
        href: "/dashboard/companies",
        description: "Your registered business entities."
      },
      clients: {
        title: "Clients/Orgs",
        value: organizationsSnap.size.toString(),
        iconName: "Users",
        href: "/dashboard/organizations",
        description: "Your list of clients & organizations."
      },
      labourForce: {
        title: "Labour Force",
        value: labourSnap.size.toString(),
        iconName: "HardHat",
        href: "/dashboard/labour-register",
        description: "Registered labourers for projects."
      },
      sorRates: {
        title: "SOR Items",
        value: sorSnap.size.toString(),
        iconName: "ListOrdered",
        href: "/dashboard/sor-rates",
        description: "Your custom Schedule of Rates."
      },
      licenses: {
        title: "Licenses",
        value: licensesSnap.size.toString(),
        iconName: "Award",
        href: "/dashboard/licenses",
        description: "Your tracked business licenses."
      },
      inventory: {
        title: "Inventory Items",
        value: inventorySnap.size.toString(),
        iconName: "Package",
        href: "/dashboard/inventory",
        description: "Total items in your inventory."
      },
      followUps: {
        title: "Pending Follow-ups",
        value: followUpsSnap.size.toString(),
        iconName: "MessageSquare",
        href: "/dashboard/follow-ups",
        description: "Client interactions needing a follow-up."
      },
      dprs: {
        title: "DPRs Logged",
        value: dprSnap.size.toString(),
        iconName: "FileClock",
        href: "/dashboard/dpr",
        description: "Total daily progress reports."
      },
      svrs: {
        title: "SVRs Logged",
        value: svrSnap.size.toString(),
        iconName: "Wrench",
        href: "/dashboard/svr",
        description: "Total service visit reports."
      }
    };

    return NextResponse.json(summary, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/summary:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
