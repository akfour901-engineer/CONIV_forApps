

import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { Estimate, WorkOrder, Invoice, License, AlertItem, UserProfile, TeamMember, PurchaseOrder, LabourRegister, TeamInvitation, InventoryItem, Organization, UserNotificationPreferences, Expense, ListingItem, ActivityLog } from '@/types';
import { formatCurrency, formatDate, isExpiringSoon, addDays } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const defaultNotificationPrefs: UserNotificationPreferences = {
  importantUpdates: true, newMessages: true, invoicePaid: true,
  workOrderStatusAlerts: true, weeklyInvoiceFollowups: false, weeklySecurityDepositFollowups: false,
  weeklyFinancialSummary: false, weeklyLicensesDue: true, weeklyTopAlerts: true,
  marketplaceUpdates: true, newLoginAlerts: true,
  largeExpenseAlerts: true, projectBudgetWatch: true, profitabilityDipAlerts: true,
  lastWeeklyDigestSent:"Monday",
    preferredDigestDay: "Monday",
};


export async function GET(request: Request) {
  const functionCallId = `api_alerts_GET_${Date.now()}`;
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

    // Authorization Check
    let canAccess = false;
    let teamMemberPermissions: TeamMember['permissions'] | null = null;
    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found', code: 'AUTH_USER_PROFILE_NOT_FOUND_ALERTS_GET'}, { status: 403 });
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;

    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true; // User viewing their own data
    } else {
      // Check if authenticatedUser is a team member of requestedDataOwnerId
      if (authUserProfile.ownerId === requestedDataOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
          teamMemberPermissions = (teamMemberDocSnap.data() as TeamMember).permissions;
          canAccess = true; 
        }
      }
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden: Not authorized to view alerts for this account.', code: 'FORBIDDEN_ALERTS_ACCESS'}, { status: 403 });
    }
    
    const dataOwnerIdForQuery = requestedDataOwnerId;

    const fetchedAlerts: AlertItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const fourteenDaysFromNow = addDays(today, 14);
    const fourteenDaysAgo = addDays(today, -14);
    const sevenDaysAgo = addDays(today, -7);

    const todayStr = today.toISOString().split('T')[0];
    const LOW_POINTS_THRESHOLD = 700; // Increased to 700
    const LARGE_EXPENSE_THRESHOLD = 50000;
    
    const ownerProfileDoc = await adminDb.collection('users').doc(dataOwnerIdForQuery).get();
    const ownerProfile = ownerProfileDoc.exists ? ownerProfileDoc.data() as UserProfile : null;
    const notificationPrefs = { ...defaultNotificationPrefs, ...(ownerProfile?.notificationPreferences || {}) };


    const hasPermission = (key: keyof TeamMember['permissions']) => {
        if (authenticatedUserUid === dataOwnerIdForQuery) return true;
        return teamMemberPermissions?.[key] || false;
    };
    
    // --- System & Security Alerts ---
    if(ownerProfile) {
        if ((ownerProfile.resourcePoints ?? 0) < LOW_POINTS_THRESHOLD) {
            fetchedAlerts.push({
                id: `low-points-${dataOwnerIdForQuery}`,
                title: 'Low Resource Points',
                description: `Email notifications may fail. Your balance is low (${ownerProfile.resourcePoints ?? 0} points). Purchase more to ensure service continuity.`,
                href: '/dashboard/coins-payments/buy-coins',
                icon: 'Coins',
                type: 'system',
                date: todayStr
            });
        }
        
        if (notificationPrefs.newLoginAlerts) {
             if (!ownerProfile.is2FAEnabled && !ownerProfile.isPinEnabled) {
                 fetchedAlerts.push({
                    id: `security-nudge-${dataOwnerIdForQuery}`,
                    title: 'Enhance Your Account Security',
                    description: `Enable PIN Lock or 2FA for better protection.`,
                    href: '/dashboard/settings',
                    icon: 'ShieldCheck',
                    type: 'system',
                    date: todayStr
                });
            }

            const loginLogsSnap = await adminDb.collection('activityLogs')
                .where('ownerId', '==', dataOwnerIdForQuery)
                .orderBy('timestamp', 'desc')
                .limit(20) // Fetch recent logs
                .get();

            const recentLoginLogs: ActivityLog[] = loginLogsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog))
                .filter(log => log.actionType === 'login' && log.timestamp && new Date(log.timestamp) > sevenDaysAgo);

            recentLoginLogs.slice(0, 5).forEach(log => {
                if(log.details && typeof log.details === 'object' && 'isNewDeviceOrLocation' in log.details && !!log.details.isNewDeviceOrLocation) {
                    fetchedAlerts.push({
                        id: `new-login-${log.id}`, title: 'New Login Detected',
                        description: `A new login to your account occurred from an unrecognized device or location.`,
                        href: '/dashboard/team', icon: 'ShieldAlert', type: 'system', date: log.timestamp,
                    });
                }
            });
        }
    }

    // --- Core Document Alerts ---
    if (hasPermission('canViewEstimates') && notificationPrefs.importantUpdates) {
      const estSnap = await adminDb.collection('estimates')
        .where('userId', '==', dataOwnerIdForQuery)
        .where('status', 'in', ['submitted', 'approved'])
        .get();
      estSnap.forEach(doc => {
        const data = doc.data() as Estimate;
        if(data.status === 'submitted') {
            fetchedAlerts.push({ id: doc.id, title: `Estimate Awaiting Action: ${data.estimateNumber}`, description: `To: ${data.organizationName}, awaiting client approval.`, href: `/dashboard/estimates/${doc.id}/edit`, icon: 'FileText' as any, type: 'estimate', date: data.date });
        } else if (data.status === 'approved') {
            fetchedAlerts.push({ id: doc.id, title: `Estimate Approved: ${data.estimateNumber}`, description: `Ready to be converted to a Work Order.`, href: `/dashboard/estimates/${doc.id}/edit`, icon: 'FileCheck' as any, type: 'estimate', date: data.date });
        }
      });
    }

     if (hasPermission('canViewWorkOrders') && notificationPrefs.workOrderStatusAlerts) {
        const woSnap = await adminDb.collection('workOrders').where('userId', '==', dataOwnerIdForQuery).get();
        const allInvoicesSnap = await adminDb.collection('invoices').where('userId', '==', dataOwnerIdForQuery).get();
        const allExpensesSnap = await adminDb.collection('expenses').where('userId', '==', dataOwnerIdForQuery).get();
        const allPOsSnap = await adminDb.collection('purchaseOrders').where('userId', '==', dataOwnerIdForQuery).get();
        
        const woData = woSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as WorkOrder & {id: string});
        const allInvoices = allInvoicesSnap.docs.map(doc => doc.data() as Invoice);
        const allExpenses = allExpensesSnap.docs.map(doc => doc.data() as Expense);
        const allPOs = allPOsSnap.docs.map(doc => doc.data() as PurchaseOrder);

        for (const data of woData) {
            try {
                const woStartDate = new Date(data.startDate);
                const woEndDate = new Date(data.endDate);

                if (['pending', 'on-hold'].includes(data.status)) {
                    fetchedAlerts.push({ id: `${data.id}-status`, title: `WO Action: ${data.workOrderNumber} (${data.status})`, description: `For: ${data.organizationName}, starts ${woStartDate.toLocaleDateString()}`, href: `/dashboard/work-orders/${data.id}/details`, icon: 'ClipboardList' as any, type: 'workOrder', date: data.startDate });
                }
                if (woEndDate < fourteenDaysFromNow && woEndDate >= today) {
                    fetchedAlerts.push({ id: `${data.id}-due`, title: `WO Nearing Due Date: ${data.workOrderNumber}`, description: `Due on ${woEndDate.toLocaleDateString()}. Plan for completion.`, href: `/dashboard/work-orders/${data.id}/details`, icon: 'CalendarClock' as any, type: 'workOrder', date: data.endDate });
                }
                if(woEndDate < woStartDate) {
                    fetchedAlerts.push({ id: `${data.id}-timeline`, title: `WO Timeline Issue: ${data.workOrderNumber}`, description: `End date (${woEndDate.toLocaleDateString()}) is before start date (${woStartDate.toLocaleDateString()}).`, href: `/dashboard/work-orders/${data.id}/edit`, icon: 'CalendarX2' as any, type: 'workOrder', date: data.startDate });
                }
                if(data.status === 'in-progress') {
                    fetchedAlerts.push({ id: `${data.id}-dpr`, title: `Log DPR for WO: ${data.workOrderNumber}`, description: `Remember to log today's progress for this ongoing work order.`, href: `/dashboard/dpr/new?workOrderId=${data.id}`, icon: 'FileClock' as any, type: 'workOrder', date: todayStr });
                }
                if(notificationPrefs.weeklyInvoiceFollowups && data.status === 'completed') {
                    const hasPaidInvoice = allInvoices.some(inv => inv.workOrderId === data.id && ['paid', 'partially-paid'].includes(inv.status));
                    if (!hasPaidInvoice) {
                        fetchedAlerts.push({ id: `${data.id}-uninvoiced`, title: `Uninvoiced Completed WO: ${data.workOrderNumber}`, description: `This WO is complete but has no paid invoice. Create one to get paid.`, href: `/dashboard/invoices/new?workOrderId=${data.id}`, icon: 'Receipt', type: 'invoice', date: data.endDate });
                    }
                }
                if (notificationPrefs.projectBudgetWatch || notificationPrefs.profitabilityDipAlerts) {
                    const totalExpenses = allExpenses.filter(e => e.workOrderId === data.id).reduce((sum, e) => sum + e.amount, 0);
                    const totalPoCost = allPOs.filter(po => po.workOrderId === data.id && po.status !== 'cancelled').reduce((sum, po) => sum + po.grandTotal, 0);
                    const totalCost = totalExpenses + totalPoCost;
                    
                    if (notificationPrefs.projectBudgetWatch && data.grandTotal > 0 && (totalCost / data.grandTotal) > 0.8) {
                        fetchedAlerts.push({ id: `${data.id}-budget`, title: `Budget Watch: ${data.workOrderNumber}`, description: `Over 80% of project budget consumed.`, href: `/dashboard/financial-summary`, icon: 'TrendingDown', type: 'financial', date: todayStr });
                    }
                    
                    const totalRevenue = allInvoices.filter(inv => inv.workOrderId === data.id && inv.status === 'paid').reduce((sum, inv) => sum + inv.grandTotal, 0);
                    if (notificationPrefs.profitabilityDipAlerts && totalRevenue > 0 && ((totalRevenue - totalCost) / totalRevenue) < 0.15) {
                        fetchedAlerts.push({ id: `${data.id}-profit`, title: `Profitability Alert: ${data.workOrderNumber}`, description: `Project profit margin is below 15%.`, href: `/dashboard/financial-summary`, icon: 'TrendingDown', type: 'financial', date: todayStr });
                    }
                }

                if (notificationPrefs.weeklySecurityDepositFollowups) {
                    if ((data.securityDeposit ?? 0) > 0 && data.depositPeriod !== undefined && data.depositPeriod !== null) {
                        const sdDueDate = addDays(woEndDate, data.depositPeriod * 30); // Approximation
                        if (isExpiringSoon(sdDueDate.toISOString(), 90)) {
                            fetchedAlerts.push({ id: `${data.id}-sd`, title: `Security Deposit Due Soon`, description: `For WO #${data.workOrderNumber}. Due for return on ${sdDueDate.toLocaleDateString()}.`, href: `/dashboard/work-orders/${data.id}/details`, icon: 'ShieldCheck' as any, type: 'workOrder', date: sdDueDate.toISOString().split('T')[0] });
                        }
                    }
                }

            } catch (dateError) {
                console.warn(`Could not parse date for WO ${data.id}, skipping some alerts for it.`);
            }
        };

        if (notificationPrefs.importantUpdates) {
            const completedWoSnap = await adminDb.collection('workOrders').where('userId', '==', dataOwnerIdForQuery).where('status', '==', 'completed').get();
            for (const woDoc of completedWoSnap.docs) {
                const labourForWoSnap = await adminDb.collection('labourRegisters').where('workOrderId', '==', woDoc.id).get();
                const unpaidLabourers = labourForWoSnap.docs.filter(doc => (doc.data() as LabourRegister).netAmount > 0).length;
                if (unpaidLabourers > 0) {
                    fetchedAlerts.push({ id: `${woDoc.id}-unpaid-labour`, title: `Unpaid Labour on Completed WO: ${woDoc.data().workOrderNumber}`, description: `${unpaidLabourers} labourer(s) have outstanding payments. Please clear dues.`, href: `/dashboard/labour-register`, icon: 'HandCoins' as any, type: 'labour', date: todayStr });
                }
            }
        }
    }

    if (hasPermission('canViewInvoices') && notificationPrefs.weeklyInvoiceFollowups) {
      const invSnap = await adminDb.collection('invoices').where('userId', '==', dataOwnerIdForQuery).get();
      for (const doc of invSnap.docs) {
          const data = doc.data() as Invoice;
          try {
              const dueDate = new Date(data.dueDate);
              if (['unpaid', 'sent', 'partially-paid'].includes(data.status) && dueDate < today) {
                fetchedAlerts.push({ id: `${doc.id}-overdue`, title: `Invoice Overdue: ${data.invoiceNumber}`, description: `To: ${data.organizationName}, was due on ${dueDate.toLocaleDateString()}`, href: `/dashboard/invoices/${doc.id}`, icon: 'Receipt' as any, type: 'invoice', date: data.dueDate });
              }
              else if (['unpaid', 'sent', 'partially-paid'].includes(data.status) && dueDate < fourteenDaysFromNow) {
                fetchedAlerts.push({ id: `${doc.id}-due-soon`, title: `Invoice Follow-up: ${data.invoiceNumber}`, description: `Due on ${dueDate.toLocaleDateString()}. Send a reminder.`, href: `/dashboard/invoices/${doc.id}`, icon: 'MailQuestion' as any, type: 'invoice', date: data.dueDate });
              }
          } catch(e) { console.warn(`Could not parse date for invoice ${doc.id}`); }
      }
    }
    
    if (notificationPrefs.invoicePaid && hasPermission('canViewInvoices')) {
        const activityLogQuery = await adminDb.collection('activityLogs')
            .where('ownerId', '==', dataOwnerIdForQuery)
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
    
        const recentPaidLogs = activityLogQuery.docs
            .map(doc => doc.data() as ActivityLog)
            .filter(logData => 
                logData.actionType === 'status_changed_invoice' &&
                logData.details && typeof logData.details === 'object' && 'newStatus' in logData.details && logData.details.newStatus === 'paid' && 
                new Date(logData.timestamp) > sevenDaysAgo
            );
        
        recentPaidLogs.forEach(logData => {
            fetchedAlerts.push({
                id: `paid-inv-${logData.entityId}`,
                title: `Invoice Paid: ${logData.entityName}`,
                description: `Payment was recorded.`,
                href: `/dashboard/invoices/${logData.entityId}`,
                icon: 'CircleDollarSign' as any,
                type: 'invoice',
                date: logData.timestamp,
            });
        });
    }

    if(hasPermission('canViewPurchaseOrders') && notificationPrefs.importantUpdates) {
        const poSnap = await adminDb.collection('purchaseOrders').where('userId', '==', dataOwnerIdForQuery).where('status', 'in', ['pending_approval', 'approved']).get();
        poSnap.forEach(doc => {
            const data = doc.data() as PurchaseOrder;
            fetchedAlerts.push({ id: doc.id, title: `PO Follow-up: ${data.poNumber}`, description: `Status is '${data.status}'. Awaiting next action.`, href: `/dashboard/advance-tools/purchase-orders/${doc.id}`, icon: 'ShoppingCart' as any, type: 'purchaseOrder', date: data.date });
        });
    }
    
    if(notificationPrefs.largeExpenseAlerts) {
        const allExpensesSnap = await adminDb.collection('expenses').where('userId', '==', dataOwnerIdForQuery).get();
        const recentLargeExpenses = allExpensesSnap.docs
            .map(doc => doc.data() as Expense)
            .filter(expense => 
                expense.amount > LARGE_EXPENSE_THRESHOLD && 
                expense.createdAt && 
                new Date(expense.createdAt) > sevenDaysAgo
            );
        
        recentLargeExpenses.forEach(expense => {
            if (expense.id) { // Ensure expense.id is not undefined
                 fetchedAlerts.push({ id: expense.id, title: `Large Expense Logged`, description: `${formatCurrency(expense.amount)} for ${expense.description}.`, href: `/dashboard/expenses/${expense.id}/edit`, icon: 'Banknote', type: 'financial', date: expense.createdAt! });
            }
        });
    }

    if(hasPermission('canManageOrganizations') && notificationPrefs.newMessages) { // Assuming 'newMessages' covers CRM type alerts
      const leadSnap = await adminDb.collection('organizations')
        .where('userId', '==', dataOwnerIdForQuery)
        .where('organizationStatus', '==', 'Lead')
        .get();
      leadSnap.forEach(doc => {
        const data = doc.data() as Organization;
        const updatedAt = new Date(data.updatedAt);
        if (updatedAt < fourteenDaysAgo) {
          fetchedAlerts.push({ id: doc.id, title: `Stale Lead: ${data.name}`, description: `No updates in over 14 days. Time to follow up!`, href: `/dashboard/organizations/${doc.id}`, icon: 'UserRoundX' as any, type: 'organization', date: data.updatedAt });
        }
      });
    }

    if (hasPermission('canManageOwnerLicenses') && notificationPrefs.importantUpdates) {
      const licSnap = await adminDb.collection('licenses').where('userId', '==', dataOwnerIdForQuery).get(); 
      licSnap.docs.forEach(d => {
        const lic = { id: d.id, ...d.data() } as License;
        if(isExpiringSoon(lic.expiryDate, 90)) {
             fetchedAlerts.push({ id: lic.id!, title: `License Expiring: ${lic.licenseName}`, description: `Authority: ${lic.issuingAuthority}, Expires: ${formatDate(lic.expiryDate)}`, href: `/dashboard/licenses/${lic.id}/edit`, icon: 'Award' as any, type: 'license', date: lic.expiryDate });
        }
      });
    }
    
    if (hasPermission('canManageLabourRegister') && notificationPrefs.importantUpdates) {
        const labourSnap = await adminDb.collection('labourRegisters').where('userId', '==', dataOwnerIdForQuery).get();
        labourSnap.forEach(doc => {
            const labourer = doc.data() as LabourRegister;
            const checkExpiry = (dateStr: string | undefined | null, docType: string) => {
                if(isExpiringSoon(dateStr, 90)) {
                    fetchedAlerts.push({ id: `${doc.id}-${docType}`, title: `${docType} Expiring for ${labourer.workerName}`, description: `Expires on ${formatDate(dateStr)}.`, href: `/dashboard/labour-register/${doc.id}/edit`, icon: 'FileWarning' as any, type: 'labour', date: dateStr! });
                }
            }
             const checkMissing = (docNumber: string | undefined | null, docType: string) => {
                if (!docNumber) {
                    fetchedAlerts.push({ id: `${doc.id}-missing-${docType}`, title: `Missing Document: ${docType} for ${labourer.workerName}`, description: `Please upload the required document.`, href: `/dashboard/labour-register/${doc.id}/edit`, icon: 'FileWarning', type: 'labour', date: todayStr });
                }
            };

            checkExpiry(labourer.medicalCertificateExpiry, "Medical Certificate");
            checkExpiry(labourer.nocExpiry, "NOC");
            checkExpiry(labourer.gatePassExpiry, "Gate Pass");
            
            checkMissing(labourer.medicalCertificateNumber, "Medical Certificate");
            checkMissing(labourer.nocNumber, "NOC");
            checkMissing(labourer.identityProofNumber, "Identity Proof");
            checkMissing(labourer.gatePassNumber, "Gate Pass");
        });
    }

    if (hasPermission('canManageInventory') && notificationPrefs.importantUpdates) {
        const invSnap = await adminDb.collection('inventoryItems').where('userId', '==', dataOwnerIdForQuery).get();
        invSnap.forEach(doc => {
            const item = doc.data() as InventoryItem;
            const quantity = item.quantityOnHand ?? Infinity;
            const threshold = item.lowStockThreshold;
            if (threshold !== null && threshold !== undefined && quantity <= threshold) {
                fetchedAlerts.push({
                    id: `${doc.id}-low-stock`,
                    title: `Low Stock: ${item.name}`,
                    description: `Current quantity (${quantity}) is at or below the threshold (${threshold}).`,
                    href: `/dashboard/inventory/${item.id}/edit`,
                    icon: 'PackageSearch' as any,
                    type: 'inventory',
                    date: todayStr
                });
            }
        });
    }
    if (notificationPrefs.marketplaceUpdates) {
        const listingsSnap = await adminDb.collection('listingItems').where('userId', '==', dataOwnerIdForQuery).where('status', '==', 'active').get();
        listingsSnap.forEach(doc => {
            const item = doc.data() as ListingItem;
            const expiryDate = addDays(new Date(item.createdAt), 60); // Assuming 60 day expiry
            if (isExpiringSoon(expiryDate.toISOString(), 7)) {
                 fetchedAlerts.push({ id: doc.id, title: `Marketplace Listing Expiring: ${item.title}`, description: `Your listing will expire soon. Renew it to keep it active.`, href: `/dashboard/advance-tools/buy-sell-exchange/${doc.id}/edit`, icon: 'Store' as any, type: 'system', date: expiryDate.toISOString().split('T')[0] });
            }
        });
    }

    if (hasPermission('canManageTeam') && notificationPrefs.newMessages) {
        const inviteSnap = await adminDb.collection('teamInvitations').where('ownerId', '==', dataOwnerIdForQuery).where('status', '==', 'pending').get();
        inviteSnap.forEach(doc => {
            const data = doc.data() as TeamInvitation;
            fetchedAlerts.push({ id: doc.id, title: `Invitation Pending for ${data.invitedMemberName}`, description: `Sent to ${data.invitedEmail || data.invitedPhoneNumber}.`, href: `/dashboard/team`, icon: 'UserPlus' as any, type: 'team', date: data.createdAt });
        });

        const permissionsLogSnap = await adminDb.collection('activityLogs').where('ownerId', '==', dataOwnerIdForQuery).where('actionType', '==', 'permissions_updated').get();
        const recentPermissionLogs = permissionsLogSnap.docs.filter(doc => (doc.data() as ActivityLog).timestamp && new Date((doc.data() as ActivityLog).timestamp) > sevenDaysAgo);
        recentPermissionLogs.forEach(doc => {
            const log = doc.data() as ActivityLog;
            fetchedAlerts.push({ id: `perm-log-${doc.id}`, title: `Team Permissions Changed`, description: `${log.actorName} updated permissions for ${log.entityName}.`, href: `/dashboard/team`, icon: 'UserCog', type: 'team', date: log.timestamp });
        });
    }

    fetchedAlerts.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    
    const limitParam = url.searchParams.get('limit');
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        return NextResponse.json(fetchedAlerts.slice(0, limit), { status: 200 });
      }
    }

    return NextResponse.json(fetchedAlerts, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/alerts API:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
