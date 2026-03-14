
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import type { AppConfiguration, LabourRegister, UserProfile, WorkOrder } from '@/types/server-only';
import { z } from 'zod';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
export const dynamic = 'force-dynamic';
const LaborAnalysisInputSchema = z.object({
  workOrderId: z.string(),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
export type LaborAnalysisInput = z.infer<typeof LaborAnalysisInputSchema>;

const AIModelOutputSchema = z.object({
  auditSummary: z.string().describe('A summary of the labor data analysis, noting total costs, number of laborers, and overall efficiency.'),
  suggestedCorrections: z.string().describe('Specific suggestions for improving labor efficiency, cost management, or data logging practices.'),
  riskAssessment: z.string().describe('An assessment of potential risks, such as cost overruns, compliance issues from missing data, or productivity concerns.'),
});

export const LaborAnalysisOutputSchema = AIModelOutputSchema.extend({
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
export type LaborAnalysisOutput = z.infer<typeof LaborAnalysisOutputSchema>;

const analyzeLaborFlow = ai.defineFlow(
  {
    name: 'analyzeLaborFlow',
    inputSchema: LaborAnalysisInputSchema,
    outputSchema: LaborAnalysisOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, workOrderId, actorUid, actorName } = input;

    const DEFAULT_COST = 30;
    let actualCost = DEFAULT_COST;
    try {
      const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if (configDoc.exists) {
        const config = configDoc.data() as AppConfiguration;
        const costConfig = config.actionCosts?.find((c) => c.key === 'AI_LABOR_ANALYSIS_COST');
        if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
      }
    } catch (e) {
      console.warn('Could not fetch cost config for Labor Analysis.');
    }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error('User profile not found.');
    const userProfileData = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfileData.resourcePoints ?? 0;
    if (currentPoints < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.`);
    }

    const woDocRef = adminDb.collection('workOrders').doc(workOrderId);
    const [woSnap, labourSnap] = await Promise.all([
      woDocRef.get(),
      adminDb.collection('labourRegisters').where('workOrderId', '==', workOrderId).get(),
    ]);

    if (!woSnap.exists) throw new Error('Work Order not found.');
    const workOrder = woSnap.data() as WorkOrder;
    if (workOrder.userId !== userId) throw new Error('Access denied to work order.');

    const workOrderSummary = `WO#: ${workOrder.workOrderNumber}, Scope: ${workOrder.scopeOfWork}, Budget: ${workOrder.grandTotal}`;

    let laborDataSummary = '';
    if (labourSnap.empty) {
      laborDataSummary = 'No laborers are registered for this work order.';
    } else {
      const laborers = labourSnap.docs.map((doc) => doc.data() as LabourRegister);
      laborDataSummary = `Total Laborers: ${laborers.length}\n`;
      laborers.forEach((l) => {
        laborDataSummary += `- Name: ${l.workerName}, Role: ${l.role}, Daily Wage: ${l.dailyWage}, Total Paid: ${l.advancesPaid}\n`;
      });
    }

    const promptText = `You are an expert project manager specializing in construction labor cost analysis. Your role is to review the provided work order and labor data to identify trends, efficiency issues, and potential cost overruns.

Analyze the following information:

Work Order Summary:
${workOrderSummary}

Labor Data Summary:
${laborDataSummary}

Based on your analysis, provide:
1. **Audit Summary:** A brief overview of the labor situation for this project. Include total labor costs, number of distinct laborers, and any immediate observations on efficiency or cost.
2. **Suggested Corrections / Efficiency Improvements:** Provide specific, actionable suggestions. Examples: "Consider consolidating roles if skill sets overlap," "Investigate the high number of overtime hours on [Date]," or "Ensure all laborers have their daily wages recorded to prevent payment disputes."
3. **Risk Assessment:** Identify potential risks. Examples: "High labor cost variance poses a risk to project profitability," "Inconsistent attendance logging may lead to payment disputes," or "Lack of documented roles could lead to compliance issues."`;
    
    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema: AIModelOutputSchema },
                config: { temperature: 0.3 }
            });
            break; // Success, exit loop
        } catch (error: any) {
            console.warn(`Model ${modelName} failed. Error: ${error.message}`);
            if (MODEL_FALLBACK_LIST.indexOf(modelName) === MODEL_FALLBACK_LIST.length - 1) {
                // This was the last model, rethrow the error
                throw error;
            }
        }
    }

    if (!response) {
      throw new Error('AI model did not return a valid analysis after trying all fallbacks.');
    }
    const output = response.output;
    if (!output) throw new Error('AI model did not return a valid analysis.');

    const newResourcePoints = currentPoints - actualCost;
    await userProfileRef.update({
      resourcePoints: newResourcePoints,
      resourcePointsLastUpdated: new Date().toISOString(),
    });

    await logActivity({
      ownerId: userId,
      actorUid: actorUid || userId,
      actorName: actorName || userProfileData.fullName || userProfileData.email || 'User',
      actionType: 'audit_run',
      entityType: 'AI',
      entityName: `AI Labor Analysis for WO: ${workOrder.workOrderNumber}`,
      details: { cost: actualCost, message: 'AI Labor Analysis performed.' },
    });

    return { ...output, newResourcePoints };
  },
);

export async function runLaborAnalysis(input: LaborAnalysisInput): Promise<LaborAnalysisOutput> {
    return await analyzeLaborFlow(input);
}
