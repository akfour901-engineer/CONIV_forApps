import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, WorkOrder, AppConfiguration } from '@/types/server-only';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export const dynamic = 'force-dynamic';

const WOAnalysisInputSchema = z.object({
  workOrderId: z.string(),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type WOAnalysisInput = z.infer<typeof WOAnalysisInputSchema>;

const AIModelOutputSchema = z.object({
  auditSummary: z.string().describe("A summary of the work order analysis, noting overall status, financial health, and progress."),
  suggestedCorrections: z.string().describe("Specific suggestions for improving the work order's execution, cost management, or documentation."),
  riskAssessment: z.string().describe("An assessment of potential risks, such as schedule delays, cost overruns, or incomplete documentation."),
});

async function analyzeWorkOrderFlow(input: WOAnalysisInput) {
    const adminDb = getDb();
    const { userId, workOrderId } = input;

    const woDocRef = adminDb.collection('workOrders').doc(workOrderId);
    const [woSnap, invoicesSnap, expensesSnap] = await Promise.all([
      woDocRef.get(),
      adminDb.collection('invoices').where('workOrderId', '==', workOrderId).get(),
      adminDb.collection('expenses').where('workOrderId', '==', workOrderId).get(),
    ]);

    if (!woSnap.exists) throw new Error('Work Order not found.');
    const workOrder = woSnap.data() as WorkOrder;
    if (workOrder.userId !== userId) throw new Error('Access denied to this work order.');

    const invoices = invoicesSnap.docs.map(doc => doc.data());
    const expenses = expensesSnap.docs.map(doc => doc.data());

    const woSummary = `Work Order: ${workOrder.workOrderNumber}, Scope: ${workOrder.scopeOfWork}, Budget: ${workOrder.grandTotal}, Status: ${workOrder.status}`;
    const invoiceSummary = invoices.length > 0 ? `Invoices (${invoices.length})` : "No invoices linked.";
    const expenseSummary = expenses.length > 0 ? `Expenses (${expenses.length})` : "No expenses logged.";

    const promptText = `
      You are an expert construction project auditor. Analyze the following project data to provide an audit summary, suggested corrections, and a risk assessment.

      Project Data:
      - ${woSummary}
      - ${invoiceSummary}
      - ${expenseSummary}

      Based on this, provide your analysis.
    `;
    
    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema: AIModelOutputSchema },
                config: { temperature: 0.4 }
            });
            if (response) break;
        } catch (error) {
            console.warn(`Model ${modelName} failed for WO Analysis.`);
        }
    }

    if (!response || !response.output) throw new Error('AI model did not return a valid analysis.');
    return response.output;
}

export async function POST(request: Request) {
  const authAdmin = getAuth();
  const adminDb = getDb();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);

    const input: WOAnalysisInput = await request.json();
    if (decodedToken.uid !== input.actorUid) {
      return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }

    let actualCost = 35;
    const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
    if (configDoc.exists) {
        const config = configDoc.data() as AppConfiguration;
        const costConfig = config.actionCosts?.find(c => c.key === 'AI_WO_ANALYSIS_COST');
        if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
    }
    
    const userProfileRef = adminDb.collection('users').doc(input.userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error('User profile not found.');
    const userProfileData = userProfileSnap.data() as UserProfile;
    if ((userProfileData.resourcePoints ?? 0) < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    const result = await analyzeWorkOrderFlow(input);
    
    const newResourcePoints = (userProfileData.resourcePoints ?? 0) - actualCost;
    await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
    
    await logActivity({
      ownerId: input.userId,
      actorUid: input.actorUid || input.userId,
      actorName: input.actorName || userProfileData.fullName || 'User',
      actionType: 'audit_run',
      entityType: 'AI',
      entityName: `AI WO Analysis`,
      details: { cost: actualCost, message: 'AI Work Order Analysis performed.' },
    });

    return NextResponse.json({ ...result, newResourcePoints }, { status: 200 });
  } catch (error: any) {
    console.error(`Error in /api/ai/analyze-work-order:`, error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
