'use server';

/**
 * @fileOverview A flow to compile and send a weekly email digest to a user based on their notification preferences.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import { sendEmail } from '@/lib/email/server-only-index';
import type { UserProfile, Invoice, License, AlertItem, WorkOrder, Expense, PurchaseOrder, ListingItem, UserNotificationPreferences, AppConfiguration } from '@/types/server-only';
import { format, startOfWeek, endOfWeek, addDays, parseISO, isBefore, startOfToday, isAfter } from 'date-fns';
import { formatCurrency, formatDate } from '@/lib/utils';
import { WEEKLY_EMAIL_DIGEST_COST } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';
import { FieldValue } from 'firebase-admin/firestore';

const SendWeeklyEmailDigestInputSchema = z.object({
  userId: z.string(),
});

const SendWeeklyEmailDigestOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  emailSent: z.boolean(),
});

export async function sendWeeklyEmailDigest(input: z.infer<typeof SendWeeklyEmailDigestInputSchema>): Promise<z.infer<typeof SendWeeklyEmailDigestOutputSchema>> {
  return await sendWeeklyEmailDigestFlow(input);
}

const isExpiringSoon = (expiryDateString: string | null | undefined, days: number): boolean => {
    if (!expiryDateString) return false;
    try {
        const expiryDate = parseISO(expiryDateString);
        const today = startOfToday();
        const targetDate = addDays(today, days);
        return isBefore(expiryDate, targetDate) && !isBefore(expiryDate, today);
    } catch (e) {
        return false;
    }
};

const sendWeeklyEmailDigestFlow = ai.defineFlow(
  {
    name: 'sendWeeklyEmailDigestFlow',
    inputSchema: SendWeeklyEmailDigestInputSchema,
    outputSchema: SendWeeklyEmailDigestOutputSchema,
  },
  async ({ userId }) => {
    const adminDb = getDb();
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return { success: false, message: 'User not found.', emailSent: false };
    }

    const userProfile = userSnap.data() as UserProfile;
    const prefs = userProfile.notificationPreferences;
    
    
    const todayStr = format(startOfToday(), 'yyyy-MM-dd');

    

    if ((userProfile.resourcePoints ?? 0) < 700) {
        return { success: true, message: 'User has insufficient points for email notifications.', emailSent: false };
    }
    
    if (!prefs || Object.values(prefs).every(v => v === false)) {
      return { success: true, message: 'User has all notifications disabled.', emailSent: false };
    }

    if (prefs.lastWeeklyDigestSent === todayStr) {
        return {
          success: true,
          message: 'Digest already sent today (idempotency check)',
          emailSent: false,
        };
      }
    const today = new Date();
    const oneWeekAgo = addDays(today, -7);
    
    let contentHtml = "";
    let activeSectionsCount = 0;
    
    const createHtmlList = (items: string[], title: string, emptyMessage: string = 'No items to report this week.') => {
        if (items.length === 0) return `<h3 style="color:#005a5a;border-bottom:1px solid #eee;padding-bottom:5px;margin-top:20px;">${title}</h3><p style="font-size:12px;color:#666;">${emptyMessage}</p>`;
        activeSectionsCount++;
        let html = `<h3 style="color:#005a5a;border-bottom:1px solid #eee;padding-bottom:5px;margin-top:20px;">${title}</h3>`;
        html += `<ul style="list-style-type:disc;padding-left:20px;">${items.map(item => `<li style="margin-bottom:5px;font-size:13px;">${item}</li>`).join('')}</ul>`;
        return html;
    }

    if (prefs.weeklyTopAlerts) {
        const allAlerts = (await adminDb.collection('alerts').where('userId', '==', userId).get()).docs.map(doc => doc.data() as AlertItem);
        const recentAlerts = allAlerts.filter(alert => isAfter(parseISO(alert.date ?? new Date(0).toISOString()), oneWeekAgo)).sort((a,b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
        const topAlerts = recentAlerts.slice(0, 5).map(doc => `<strong>${doc.title}:</strong> ${doc.description}`);
        contentHtml += createHtmlList(topAlerts, 'Top Alerts This Week', 'No new critical alerts.');
    }
    if (prefs.weeklyInvoiceFollowups) {
        const allInvoices = (await adminDb.collection('invoices').where('userId', '==', userId).get()).docs.map(doc => doc.data() as Invoice);
        const overdueInvoices = allInvoices.filter(inv => ['overdue', 'unpaid', 'sent'].includes(inv.status) && isBefore(parseISO(inv.dueDate), today)).map(inv => `<strong>${inv.invoiceNumber}</strong> to ${inv.organizationName} - ${formatCurrency(inv.balanceDue)} overdue.`);
        const dueSoonInvoices = allInvoices.filter(inv => ['unpaid', 'sent'].includes(inv.status) && !isBefore(parseISO(inv.dueDate), today) && isExpiringSoon(inv.dueDate, 7)).map(inv => `<strong>${inv.invoiceNumber}</strong> to ${inv.organizationName} - ${formatCurrency(inv.balanceDue)} due on ${formatDate(inv.dueDate)}.`);
        contentHtml += createHtmlList(overdueInvoices, 'Overdue Invoices', 'No overdue invoices. Great job!');
        contentHtml += createHtmlList(dueSoonInvoices, 'Invoices Due Soon', 'No invoices due in the next 7 days.');
    }
    if (prefs.weeklyLicensesDue) {
        const expiringLicenses = (await adminDb.collection('licenses').where('userId', '==', userId).get()).docs.map(doc => doc.data() as License).filter(lic => isExpiringSoon(lic.expiryDate, 90)).map(lic => `<strong>${lic.licenseName}</strong> (${lic.licenseNumber}) expires on ${formatDate(lic.expiryDate)}.`);
        contentHtml += createHtmlList(expiringLicenses, 'Licenses Expiring Soon', 'No licenses expiring in the next 90 days.');
    }
    
    if (prefs.weeklyFinancialSummary || prefs.profitabilityDipAlerts || prefs.projectBudgetWatch || prefs.largeExpenseAlerts) {
       const [invoicesSnap, expensesSnap, workOrdersSnap, poSnap] = await Promise.all([
           adminDb.collection('invoices').where('userId', '==', userId).get(),
           adminDb.collection('expenses').where('userId', '==', userId).get(),
           adminDb.collection('workOrders').where('userId', '==', userId).where('status', '==', 'in-progress').get(),
           adminDb.collection('purchaseOrders').where('userId', '==', userId).get(),
       ]);

       const weeklyInvoices = invoicesSnap.docs.map(d => d.data() as Invoice).filter(i => isAfter(parseISO(i.date), oneWeekAgo));
       const weeklyExpensesDocs = expensesSnap.docs.map(d => d.data() as Expense).filter(e => isAfter(parseISO(e.date), oneWeekAgo));

       const weeklyRevenue = weeklyInvoices.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.grandTotal, 0);
       const weeklyExpensesTotal = weeklyExpensesDocs.reduce((sum, d) => sum + d.amount, 0);
       
       if(prefs.weeklyFinancialSummary) {
           const financialSummaryItems = [ `<strong>Revenue this week:</strong> ${formatCurrency(weeklyRevenue)}`, `<strong>Expenses this week:</strong> ${formatCurrency(weeklyExpensesTotal)}`, `<strong>Net this week:</strong> ${formatCurrency(weeklyRevenue - weeklyExpensesTotal)}` ];
           contentHtml += createHtmlList(financialSummaryItems, 'Weekly Financial Snapshot');
       }
       if(prefs.largeExpenseAlerts) {
            const largeExpenses = weeklyExpensesDocs.filter(e => e.amount > 50000).map(e => `A large expense of ${formatCurrency(e.amount)} for "${e.description}" was logged.`);
            contentHtml += createHtmlList(largeExpenses, 'Large Expense Alerts', 'No large expenses logged this week.');
       }
       if(prefs.projectBudgetWatch) {
           const allExpenses = expensesSnap.docs.map(doc => doc.data() as Expense);
           const allPOs = poSnap.docs.map(doc => doc.data() as PurchaseOrder);
           const budgetAlerts = (workOrdersSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as WorkOrder & {id: string}))).map(wo => {
               const totalExpenses = allExpenses.filter(e => e.workOrderId === wo.id).reduce((sum, e) => sum + e.amount, 0);
               const totalPoCost = allPOs.filter(po => po.workOrderId === wo.id && po.status !== 'cancelled').reduce((sum, po) => sum + po.grandTotal, 0);
               const totalCost = totalExpenses + totalPoCost;
               const budgetConsumed = (wo.grandTotal > 0) ? (totalCost / wo.grandTotal) * 100 : 0;
               if (budgetConsumed > 80) return `Project <strong>${wo.workOrderNumber}</strong> has consumed over 80% (${budgetConsumed.toFixed(0)}%) of its budget.`;
               return null;
           }).filter((s): s is string => !!s);
           contentHtml += createHtmlList(budgetAlerts, 'Project Budget Watch', 'All projects are within budget thresholds.');
       }
    }
     if (prefs.workOrderStatusAlerts) {
        const endingSoonWOs = (await adminDb.collection('workOrders').where('userId', '==', userId).get()).docs.map(doc => doc.data() as WorkOrder).filter(wo => isExpiringSoon(wo.endDate, 7)).map(wo => `<strong>${wo.workOrderNumber}</strong> for ${wo.organizationName} is nearing its end date on ${formatDate(wo.endDate)}.`);
        contentHtml += createHtmlList(endingSoonWOs, 'Work Orders Nearing Deadline', 'No projects nearing deadlines this week.');
    }
     if (prefs.weeklySecurityDepositFollowups) {
        const sdAlerts = (await adminDb.collection('workOrders').where('userId', '==', userId).where('status', '==', 'completed').get()).docs.map(doc => doc.data() as WorkOrder).map(wo => {
            if ((wo.securityDeposit ?? 0) > 0 && wo.depositPeriod !== undefined && wo.depositPeriod !== null) {
                const sdDueDate = addDays(parseISO(wo.endDate), wo.depositPeriod * 30);
                if (isBefore(sdDueDate, addDays(today, 90))) { // due in next 90 days
                    return `Security Deposit for <strong>WO #${wo.workOrderNumber}</strong> is due for return around ${formatDate(sdDueDate.toISOString())}.`;
                }
            }
            return null;
        }).filter((s): s is string => !!s);
        contentHtml += createHtmlList(sdAlerts, 'Security Deposit Follow-ups', 'No security deposits due for return soon.');
    }
    if (prefs.marketplaceUpdates) {
        const newItems = (await adminDb.collection('listingItems').where('createdAt', '>=', oneWeekAgo.toISOString()).limit(10).get()).docs.map(doc => doc.data() as ListingItem).map(item => `New listing for <strong>${item.title}</strong> (${item.itemType}) in ${item.city || 'your area'}.`);
        contentHtml += createHtmlList(newItems, 'New on Marketplace', 'No new marketplace items this week.');
    }

    if (activeSectionsCount === 0 || contentHtml==null) {
        return { success: true, message: 'No applicable data found for digest this week.', emailSent: false };
    }

    const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
    let costPerSection = WEEKLY_EMAIL_DIGEST_COST;
    let appName = "CONIV";
    if(configDoc.exists) {
        const configData = configDoc.data() as AppConfiguration;
        costPerSection = configData.actionCosts?.find((c: any) => c.key === 'WEEKLY_EMAIL_DIGEST_COST')?.cost ?? WEEKLY_EMAIL_DIGEST_COST;
        appName = configData.appName || appName;
    }
    
    const totalCost = activeSectionsCount * costPerSection;

    if ((userProfile.resourcePoints ?? 0) < totalCost) {
        return { success: false, message: `Insufficient points to send digest. Need ${totalCost}, have ${userProfile.resourcePoints ?? 0}.`, emailSent: false };
    }
    
    let templateBody = `
        <p>Hi ${userProfile.fullName || 'Valued User'},</p>
        <p>Here is your weekly summary from ${appName}.</p>
        ${contentHtml}
        <p style="margin-top:20px;">You can log in to your dashboard to manage these items.</p>
    `;
    
    const emailResult = await sendEmail({
        to: userProfile.email!,
        subject: `[${appName}] Your Weekly Digest`,
        body: templateBody,
        fromKey: 'business',
    });

    if (emailResult.success) {
        const todayDateString = format(startOfToday(), 'yyyy-MM-dd');
        await userRef.update({
            resourcePoints: FieldValue.increment(-totalCost),
            resourcePointsLastUpdated: new Date().toISOString(),
            lastWeeklyDigestSent: todayDateString,
         'notificationPreferences.lastWeeklyDigestSent': todayStr,
        });

        await logActivity({
            ownerId: userId,
            actorUid: 'SYSTEM',
            actorName: 'System',
            actionType: 'auto_email_sent',
            entityType: 'System',
            entityName: 'Weekly Digest',
            details: `Sent weekly digest email. Cost: ${totalCost} points for ${activeSectionsCount} sections.`
        });
        
        return { success: true, message: 'Weekly digest sent successfully.', emailSent: true };
    } else {
        return { success: false, message: `Failed to send email: ${emailResult.error}`, emailSent: false };
    }
  }
);
