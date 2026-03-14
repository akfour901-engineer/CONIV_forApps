export const dynamic = 'force-dynamic';


import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin-init';
import type { Estimate, WorkOrder, UserProfile, AppConfiguration } from '@/types/server-only';
import { AssessDocumentRiskInputSchema, RiskAssessmentAIModelOutputSchema, AssessDocumentRiskOutputSchema } from '@/types/server-only';
import type { AssessDocumentRiskInput, AssessDocumentRiskOutput } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export type { AssessDocumentRiskInput, AssessDocumentRiskOutput } from '@/types/server-only';

export const assessDocumentRiskFlow = ai.defineFlow(
  {
      name: 'assessDocumentRiskFlow_api',
      inputSchema: AssessDocumentRiskInputSchema,
      outputSchema: AssessDocumentRiskOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      const docRef = adminDb.collection(input.documentType === 'estimate' ? 'estimates' : 'workOrders').doc(input.documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
          throw new Error("Document not found or access denied.");
      }
      const documentData = docSnap.data() as Estimate | WorkOrder;
      
      const isOwner = documentData.userId === input.userId;
      if (!isOwner) {
          throw new Error("User does not have permission to access this document.");
      }
      
      const documentContent = JSON.stringify(documentData, null, 2);
      
      let actualCost = 20; // Default cost
      try {
          const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
          if (configDoc.exists) {
              const config = configDoc.data() as AppConfiguration;
              const costConfig = config.actionCosts?.find((c) => c.key === 'AI_RISK_ASSESSMENT_COST');
              if (costConfig?.cost !== undefined) {
                  actualCost = costConfig.cost;
              }
          }
      } catch (e) { console.warn("Could not fetch cost config for AI Risk Assessment."); }
      
      const userProfileRef = adminDb.collection('users').doc(input.userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found.");
      const currentPoints = (userProfileSnap.data() as UserProfile).resourcePoints ?? 0;
      if (currentPoints < actualCost) {
          throw new Error(`Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.`);
      }
      
      const promptText = `Analyze the following document content for potential business and legal risks. Provide a risk assessment, a list of potential issues, and mitigation suggestions.

Document Content:
${documentContent}
`;
      let response;
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
          console.log(`Attempting to generate with model: ${modelName}`);
          response = await ai.generate({
              prompt: promptText,
              model: modelName as any,
              output: { schema: RiskAssessmentAIModelOutputSchema },
          });
          if (response) {
            console.log(`Success with model: ${modelName}`);
            break;
          }
        } catch (e: any) {
          console.warn(`Model ${modelName} failed for risk assessment. Error: ${e.message}`);
        }
      }
      
      if (!response || !response.output) {
        throw new Error("AI model did not return an output for risk assessment after trying all fallbacks.");
      }
      const output = response.output;

      const newResourcePoints = Math.round(currentPoints - actualCost);
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: input.userId,
          actorUid: input.actorUid || input.userId,
          actorName: input.actorName || "AI User",
          actionType: 'ai_risk_assessment',
          entityType: input.documentType === 'estimate' ? 'Estimate' : 'WorkOrder',
          entityId: input.documentId,
          entityName: (documentData as any).estimateNumber || (documentData as any).workOrderNumber,
          details: { message: `AI risk assessment performed.`, cost: actualCost }
      });
      
      return { 
          ...output,
          potentialIssues: output.potentialIssues ?? [],
          mitigationSuggestions: output.mitigationSuggestions ?? [],
          newResourcePoints,
      };
  });

export async function assessDocumentRisk(input: z.infer<typeof AssessDocumentRiskInputSchema>): Promise<AssessDocumentRiskOutput> {
    return await assessDocumentRiskFlow(input);
}
