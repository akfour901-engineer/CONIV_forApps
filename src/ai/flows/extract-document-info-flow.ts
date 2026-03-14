
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration } from '@/types/server-only';
import { ExtractDocumentInfoInputSchema, ExtractDocumentInfoOutputSchema } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import type { ExtractDocumentInfoInput, ExtractDocumentInfoOutput } from '@/types/server-only';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export { type ExtractDocumentInfoInput, type ExtractDocumentInfoOutput } from '@/types/server-only';

const AIModelOutputSchema = ExtractDocumentInfoOutputSchema.omit({ newResourcePoints: true, error: true });

const extractDocumentInfoPrompt = ai.definePrompt({
    name: 'extractDocumentInfoPrompt',
    input: { schema: ExtractDocumentInfoInputSchema },
    output: { schema: AIModelOutputSchema },
    prompt: `You are an expert document analyst with OCR capabilities. Analyze the provided image.
    1. Extract all text from the document.
    2. Identify the document type (e.g., Invoice, Receipt, Work Order, Plan).
    3. Extract all relevant key-value pairs (like Invoice No., Date, Total Amount, etc.).
    4. Provide a brief analysis of the document's content and purpose.
    
    Image for analysis: {{media url=imageDataUri}}`
});


export const extractDocumentInfo = ai.defineFlow(
  {
      name: 'extractDocumentInfoFlow_api',
      inputSchema: ExtractDocumentInfoInputSchema,
      outputSchema: ExtractDocumentInfoOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      let actualCost = 10;
      try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if(configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find(c => c.key === 'AI_DOCUMENT_ANALYSIS_COST');
            if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
      } catch(e) { console.warn("Could not fetch cost for AI document analysis."); }

      const userProfileRef = adminDb.collection('users').doc(input.userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found.");
      const currentPoints = (userProfileSnap.data() as UserProfile).resourcePoints ?? 0;
      if (currentPoints < actualCost) {
          throw new Error(`Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.`);
      }

      let response;
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
          console.log(`Attempting to generate with model: ${modelName}`);
          response = await extractDocumentInfoPrompt(input, { model: modelName as any });

          if (response?.output) {
              console.log(`Success with model: ${modelName}`);
              break;
          }
        } catch (e: any) {
          console.warn(`Model ${modelName} failed for OCR, trying next...`, e);
        }
      }
      
      if (!response?.output) {
        throw new Error("AI model did not return an output for document analysis after trying all fallbacks.");
      }
      const output = response.output;
      
      const newResourcePoints = currentPoints - actualCost;
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: input.userId,
          actorUid: input.actorUid || input.userId,
          actorName: input.actorName || "AI User",
          actionType: 'ai_document_analysis',
          entityType: 'AI',
          entityName: `OCR: ${output.detectedType || 'Document'}`,
          details: { message: `AI document analysis performed.`, cost: actualCost }
      });

      return {
          ...output,
          newResourcePoints, 
      };
  });
