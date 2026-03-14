
import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration, Invoice, Expense, PurchaseOrder } from '@/types/server-only';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { format, addDays, startOfToday, parseISO, isAfter } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { CashFlowOutputSchema } from '@/types/server-only';
import type { CashFlowOutput } from '@/types/server-only';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
export const dynamic = 'force-dynamic';
const CashFlowInputSchema = z.object({
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type CashFlowInput = z.infer<typeof CashFlowInputSchema>;

const cashFlowForecasterFlow = ai.defineFlow(
  {
    name: 'cashFlowForecasterFlow_api',
    inputSchema: CashFlowInputSchema,
    outputSchema: CashFlowOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, actorUid, actorName } = input;
    
    let actualCost = 45; // Default cost
    try {
      const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if (configDoc.exists) {
        const config = configDoc.data() as AppConfiguration;
        const costConfig = config.actionCosts?.find(c => c.key === 'AI_CASH_FLOW_FORECASTER_COST');
        if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
      }
    } catch (e) { console.warn("Could not fetch cost config for Cash Flow Forecaster."); }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found.");
    const userProfileData = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfileData.resourcePoints ?? 0;
    if (currentPoints < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    const today = startOfToday();
    const [invoicesSnap, expensesSnap, poSnap] = await Promise.all([
      adminDb.collection('invoices').where('userId', '==', userId).where('status', 'in', ['unpaid', 'sent', 'overdue', 'partially-paid']).get(),
      adminDb.collection('expenses').where('userId', '==', userId).get(), // Removed date filter
      adminDb.collection('purchaseOrders').where('userId', '==', userId).where('status', 'in', ['approved', 'ordered', 'partially_received']).get(),
    ]);
    
    const invoices = invoicesSnap.docs.map(d => d.data() as Invoice);
    const ninetyDaysAgo = addDays(today, -90);
    const expenses = expensesSnap.docs.map(d => d.data() as Expense).filter(e => isAfter(parseISO(e.date), ninetyDaysAgo)); // Filter in code
    const purchaseOrders = poSnap.docs.map(d => d.data() as PurchaseOrder);

    const inflowsSummary = invoices.length > 0 ? `Upcoming Inflows (Receivables): Total ${formatCurrency(invoices.reduce((sum, inv) => sum + inv.balanceDue, 0))}\n` + invoices.slice(0,10).map(inv => `- ${formatCurrency(inv.balanceDue)} from ${inv.organizationName} due on ${inv.dueDate}`).join('\n') : "No outstanding receivables.";
    const recurringExpenses = "User has not defined recurring expenses."; // Placeholder for future feature
    const outflowsSummary = purchaseOrders.length > 0 ? `Upcoming Outflows (Payables from POs): Total ${formatCurrency(purchaseOrders.reduce((sum, po) => sum + po.grandTotal, 0))}\n` + purchaseOrders.slice(0,10).map(po => `- ${formatCurrency(po.grandTotal)} to ${po.supplierOrganizationName} for PO# ${po.poNumber}`).join('\n') : "No open purchase orders indicating future outflows.";

    const promptText = `You are a financial analyst for a contracting business. Your task is to generate a 30, 60, and 90-day cash flow forecast based on the provided data.
Today's Date: ${format(today, 'dd MMM yyyy')}

**Data Summary:**
${inflowsSummary}
${outflowsSummary}
${recurringExpenses}

**Analysis Task:**
1.  **Forecast Summary:** Briefly summarize the cash flow outlook.
2.  **30/60/90-Day Forecasts:** For each period, estimate the total inflows (from due invoices) and outflows (from purchase orders). Calculate the net cash flow for each period. Provide a brief analysis of what the numbers mean for the business.
3.  **Actionable Insights:** Provide a list of specific, actionable recommendations. Examples: "Aggressively follow up on overdue invoice from Client X," "Negotiate longer payment terms with Supplier Y," "High outflow expected in 60 days, secure a credit line if needed."
`;

    let response;
    const schema = CashFlowOutputSchema.omit({newResourcePoints: true, error: true});
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            const { output } = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                config: { temperature: 0.4 }
            });
            if (output) {
              response = schema.parse(output);
              console.log(`Success with model: ${modelName}`);
              break;
            }
        } catch (error: any) {
            console.warn(`Model ${modelName} failed for cash flow forecast. Error: ${error.message}`);
        }
    }
    
    if (!response) {
      throw new Error('AI model did not return a valid forecast after trying all fallbacks.');
    }
    const output = response;

    const newResourcePoints = Math.round(currentPoints - actualCost);
    await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
    
    await logActivity({
      ownerId: userId, actorUid: actorUid || userId, actorName: actorName || userProfileData.fullName || "User",
      actionType: 'audit_run', entityType: 'AI', entityName: `AI Cash Flow Forecast`, details: { cost: actualCost, message: 'AI Cash Flow Forecast performed.' }
    });

    return { ...output, newResourcePoints };
  }
);


export async function POST(request: Request) {
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const input: CashFlowInput = await request.json();

    if (decodedToken.uid !== input.actorUid) {
        return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }

    const result = await cashFlowForecasterFlow(input);
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error in /api/ai/cash-flow-forecaster:`, error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
