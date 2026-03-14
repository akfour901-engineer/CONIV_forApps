
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Expense, WorkOrder, AppConfiguration } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const ExpenseAnomalyInputSchema = z.object({
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
export type ExpenseAnomalyInput = z.infer<typeof ExpenseAnomalyInputSchema>;

const AnomalySchema = z.object({
  expenseId: z.string(),
  description: z.string().describe("A clear and concise description of the anomalous expense."),
  reason: z.string().describe("The specific reason why this expense is flagged as an anomaly (e.g., 'Significantly higher than average for category', 'Unusual expense category for this project type')."),
  amount: z.coerce.number().describe("The amount of the expense."),
  category: z.string().describe("The category of the expense."),
});

const AIModelOutputSchema = z.object({
  analysisSummary: z.string().describe("A brief, high-level summary of the findings."),
  riskScore: z.number().min(0).max(100).describe("An overall risk score from 0 (no risk of anomalies)."),
  anomalies: z.array(AnomalySchema).describe("A list of expenses flagged as potentially anomalous."),
  recommendations: z.string().describe("Actionable recommendations for the account owner, such as 'Review all fuel expenses for Project X' or 'Verify the vendor for the high-value 'Other' expense'."),
});


export const AnomalyOutputSchema = AIModelOutputSchema.extend({
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
export type AnomalyOutput = z.infer<typeof AnomalyOutputSchema>;

const expenseAnomalyFlow = ai.defineFlow(
  {
    name: 'expenseAnomalyFlow_api',
    inputSchema: ExpenseAnomalyInputSchema,
    outputSchema: AnomalyOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, actorUid, actorName } = input;
    
    let actualCost = 45; // Default cost
    try {
      const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if(configDoc.exists) {
          const config = configDoc.data() as AppConfiguration;
          const costConfig = config.actionCosts?.find(c => c.key === 'AI_EXPENSE_ANOMALY_COST');
          if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
      }
    } catch(e) { console.warn("Could not fetch cost config for Expense Anomaly Detection."); }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
    const userProfileData = userProfileSnap.data() as UserProfile;
    if ((userProfileData.resourcePoints ?? 0) < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    const expensesSnap = await adminDb.collection('expenses').where('userId', '==', userId).orderBy('date', 'desc').limit(500).get();
    
    if (expensesSnap.empty) {
      return {
          analysisSummary: "No expense data available to analyze.",
          riskScore: 0,
          anomalies: [],
          recommendations: "Start logging expenses to use this feature.",
          newResourcePoints: userProfileData.resourcePoints,
      };
    }

    const expenseDataSummary = expensesSnap.docs.map(doc => {
      const expense = { id: doc.id, ...doc.data() } as Expense;
      return `- ID: ${expense.id}, Date: ${expense.date}, Amount: ${expense.amount}, Category: ${expense.category}, Description: ${expense.description}, WO#: ${expense.workOrderNumber || 'N/A'}`;
    }).join('\n');

    const promptText = `You are an expert financial auditor specializing in expense analysis for construction businesses. Your task is to identify anomalies and potential fraud in the provided list of expenses.
    
    Look for patterns such as:
    - Unusually high amounts for common categories (e.g., a 'Fuel' expense of 50,000).
    - Vague or generic descriptions for large amounts.
    - Duplicate expenses (same amount and description on the same day).
    - Expenses in the 'Other' category with high values.
    - Unusual expense categories for a construction project.

    **Expense Data:**
    ${expenseDataSummary}

    **Your Analysis Task:**
    1.  **analysisSummary:** Provide a short paragraph summarizing your findings.
    2.  **riskScore:** Assign a score from 0-100 indicating the risk of anomalies or fraud.
    3.  **anomalies:** List each specific expense you deem anomalous. For each, provide its expenseId, description, amount, category and the reason it was flagged.
    4.  **recommendations:** Provide clear, actionable recommendations.
    `;
    
    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema: AIModelOutputSchema },
            });
            if (response?.output) break;
        } catch(e: any) {
            console.warn(`Expense anomaly model ${modelName} failed`, e.message);
        }
    }
    
    if (!response?.output) throw new Error("AI model did not return a valid analysis after trying all fallbacks.");

    const output = response.output;

    const newResourcePoints = (userProfileData.resourcePoints ?? 0) - actualCost;
    await userProfileRef.update({ resourcePoints: newResourcePoints });
    
    await logActivity({
        ownerId: userId,
        actorUid: actorUid || userId,
        actorName: actorName || userProfileData.fullName || "User",
        actionType: 'audit_run',
        entityType: 'AI',
        entityName: `AI Expense Anomaly Scan`,
        details: { cost: actualCost, riskScore: output.riskScore }
    });
    
    return { ...output, newResourcePoints };
  }
);


export async function runExpenseAnomalyAnalysis(input: ExpenseAnomalyInput): Promise<AnomalyOutput> {
    return await expenseAnomalyFlow(input);
}
