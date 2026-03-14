import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, Company, Estimate, WorkOrder, Invoice, Expense, PurchaseOrder, AppConfiguration } from '@/types/server-only';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { HealthCheckOutputSchema as BaseHealthCheckOutputSchema } from '@/types/server-only';
import type { HealthCheckOutput } from '@/types/server-only';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
export const dynamic = 'force-dynamic';
// Define Schemas
const HealthCheckInputSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type HealthCheckInput = z.infer<typeof HealthCheckInputSchema>;

// Correctly define the output schema by extending the base
const HealthCheckOutputSchema = BaseHealthCheckOutputSchema.extend({
  newResourcePoints: z.number().optional(),
});

const AIModelOutputSchema = z.object({
  auditSummary: z.string(),
  suggestedCorrections: z.string(),
  riskAssessment: z.string(),
});


const analyzeFinancialsPromptText = `You are an expert financial analyst for construction and contracting businesses. Your role is to conduct a "Financial Health Check" based on the provided data summary.

Analyze the following information:

**Company Profile:**
{{{companyProfileSummary}}}

**Financials Summary:**
{{{financialsSummary}}}

Based on your analysis, provide a detailed but easy-to-understand report with three sections:
1.  **Financial Summary:** A brief, high-level overview. Mention total revenue, total expenses, and the net profit/loss. Highlight any immediately obvious trends.
2.  **Suggested Actions:** Provide specific, actionable steps the user should take. Prioritize the most urgent items. Examples: "Focus on collecting the ₹50,000 balance from overdue invoices," or "Review expenses for Work Order #123, as costs are 85% of revenue with the project still in-progress."
3.  **Potential Risks:** Identify key business risks based on the data. Examples: "Risk of negative cash flow due to high outstanding receivables (₹1,20,000) despite high revenue," or "Project X shows a potential loss; re-evaluate similar future projects."
`;

// Define Genkit Flow
const financialHealthCheckFlow = ai.defineFlow(
  {
    name: 'financialHealthCheckFlow_api',
    inputSchema: HealthCheckInputSchema,
    outputSchema: HealthCheckOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      const { userId, companyId, actorUid, actorName } = input;
      
      const DEFAULT_COST = 40;
      let actualCost = DEFAULT_COST;
      try {
          const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
          if (configDoc.exists) {
              const config = configDoc.data() as AppConfiguration;
              const costConfig = config.actionCosts?.find(c => c.key === 'AI_FINANCIAL_HEALTH_COST');
              if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
          }
      } catch (e) { console.warn("Could not fetch cost config for Financial Health Check."); }
      
      const userProfileRef = adminDb.collection('users').doc(userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found.");
      const userProfileData = userProfileSnap.data() as UserProfile;
      const currentPoints = userProfileData.resourcePoints ?? 0;
      if (currentPoints < actualCost) {
        throw new Error(`Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.`);
      }

      const [companySnap, woSnap, invSnap, expSnap, poSnap] = await Promise.all([
        adminDb.collection('companies').doc(companyId).get(),
        adminDb.collection('workOrders').where('companyId', '==', companyId).where('userId', '==', userId).get(),
        adminDb.collection('invoices').where('companyId', '==', companyId).where('userId', '==', userId).get(),
        adminDb.collection('expenses').where('companyId', '==', companyId).where('userId', '==', userId).get(),
        adminDb.collection('purchaseOrders').where('companyId', '==', companyId).where('userId', '==', userId).get()
      ]);
      
      if (!companySnap.exists) throw new Error("Company not found.");
      const company = companySnap.data() as Company;
      if (company.userId !== userId) throw new Error("Access denied to company data.");

      const companyProfileSummary = `Name: ${company.name}, Type: ${company.companyType || 'N/A'}, Description: ${company.description || 'N/A'}`;
      
      const totalRevenue = invSnap.docs.filter(d => d.data().status === 'paid').reduce((sum, doc) => sum + doc.data().grandTotal, 0);
      const totalExpenses = expSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
      const totalOutstanding = invSnap.docs.filter(d => ['unpaid', 'sent', 'overdue', 'partially-paid'].includes(d.data().status)).reduce((sum, doc) => sum + doc.data().balanceDue, 0);
      const activeWOCount = woSnap.docs.filter(d => d.data().status === 'in-progress').length;

      const financialsSummary = `
        - Total Revenue (from paid invoices): ${totalRevenue.toFixed(2)}
        - Total Expenses Logged: ${totalExpenses.toFixed(2)}
        - Net Profit/Loss (based on above): ${(totalRevenue - totalExpenses).toFixed(2)}
        - Total Outstanding Receivables (from unpaid/overdue invoices): ${totalOutstanding.toFixed(2)}
        - Active Work Orders: ${activeWOCount}
        - Total Invoices: ${invSnap.size}
        - Total Purchase Orders: ${poSnap.size}
      `;

      const promptText = analyzeFinancialsPromptText
        .replace('{{{companyProfileSummary}}}', companyProfileSummary)
        .replace('{{{financialsSummary}}}', financialsSummary);
      
      let response;
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting financial health check with model: ${modelName}`);
            const { output } = await ai.generate({
              prompt: promptText,
              model: modelName as any,
              output: { schema: AIModelOutputSchema },
            });
            if (output) {
              response = output;
              console.log(`Success with model: ${modelName}`);
              break;
            }
        } catch (error: any) {
            console.warn(`Model ${modelName} failed for financial health check. Error: ${error.message}`);
        }
      }

      if (!response) {
        throw new Error("AI model did not return a valid analysis after trying all fallbacks.");
      }

      const output = response;
      
      const newResourcePoints = Math.round(currentPoints - actualCost);
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: userId,
          actorUid: actorUid || userId,
          actorName: actorName || userProfileData.fullName || "User",
          actionType: 'audit_run',
          entityType: 'AI',
          entityName: `AI Health Check for: ${company.name}`,
          details: { cost: actualCost, message: 'AI Financial Health Check performed.' }
      });
      
      return { ...output, newResourcePoints };
  }
);

// API POST Handler
export async function POST(request: Request) {
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const input: HealthCheckInput = await request.json();

    if (decodedToken.uid !== input.actorUid) {
        return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }
    
    const result = await financialHealthCheckFlow(input);

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error in /api/ai/financial-health-check:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = (error as any).status || 500;
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status });
  }
}
