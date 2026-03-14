
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration } from '@/types/server-only';
import { SuggestEstimateItemsInputSchema, AIEstimateSuggestionOutputSchema } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { AI_ESTIMATE_SUGGESTION_COST } from '@/lib/constants';
import type { SuggestEstimateItemsInput, SuggestEstimateItemsOutput } from '@/types/server-only';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export { type SuggestEstimateItemsInput, type SuggestEstimateItemsOutput } from '@/types/server-only';

const suggestEstimateItemsPromptText = `You are an expert quantity surveyor and estimator for construction and contracting projects.
Given the following project scope, provide a list of potential line items that would typically be included in a detailed estimate.
Also provide a short, professional "subjectOfWork" for the estimate based on the scope.
For each item, provide a clear description and a common unit of measure. Do not include item codes or rates.
Focus on standard items relevant to general contracting work.

Project Scope:
{{{projectScope}}}

Please provide your suggestions as a structured JSON object.
Suggest between 5 to 15 items based on the scope complexity.
If the scope is too vague or unclear, suggest very generic items like "Site Mobilization", "Preliminary Works", "Contingency" and set the subject line to "General Works".
`;


export const suggestEstimateItems = ai.defineFlow(
  {
    name: 'suggestEstimateItemsFlow_api',
    inputSchema: SuggestEstimateItemsInputSchema,
    outputSchema: AIEstimateSuggestionOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, projectScope, actorUid, actorName } = input;
    const DEFAULT_COST = 5;
    let actualCost = DEFAULT_COST;
    
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find((c: any) => c.key === "AI_ESTIMATE_SUGGESTION_COST");
            if (costConfig && typeof costConfig.cost === 'number') {
                actualCost = costConfig.cost;
            }
        }
    } catch (configError) {
        console.warn(`Error fetching app config for AI_ESTIMATE_SUGGESTION_COST, using default: ${DEFAULT_COST}`, configError);
    }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();

    if (!userProfileSnap.exists) {
      throw new Error("User profile not found. Cannot deduct resource points.");
    }
    const userProfileData = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfileData.resourcePoints ?? 0;

    if (currentPoints < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost} points, but have ${currentPoints}.`);
    }
    
    let response;
    const schema = AIEstimateSuggestionOutputSchema.omit({ newResourcePoints: true });

    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
          console.log(`Attempting to generate with model: ${modelName}`);
          const { output } = await ai.generate({
              prompt: suggestEstimateItemsPromptText.replace('{{{projectScope}}}', projectScope),
              model: modelName as any,
          });
          if (output) {
            response = schema.parse(output);
            console.log(`Success with model: ${modelName}`);
            break;
          }
        } catch (e) {
          console.warn(`Model ${modelName} failed for estimate suggestion. Error: ${e}`);
        }
    }
    
    if (!response) {
      throw new Error("AI model did not return an output for suggesting estimate items.");
    }
    const output = response;
    
    const newPoints = Math.round(currentPoints - actualCost);
    
    await userProfileRef.update({
        resourcePoints: newPoints,
        resourcePointsLastUpdated: new Date().toISOString(),
    });
    
    await logActivity({
        ownerId: userId, 
        actorUid: actorUid || userId,
        actorName: actorName || userProfileData.fullName || "AI User",
        actionType: 'ai_estimate_suggestion',
        entityType: 'AI',
        entityName: 'Estimate Item Suggestion',
        details: { message: `Scope: ${projectScope.substring(0, 100)}...`, cost: actualCost }
    });
    
    if (!output.suggestedItems || !Array.isArray(output.suggestedItems)) {
        return { subjectOfWork: output.subjectOfWork || "General Works", suggestedItems: [], newResourcePoints: newPoints };
    }
    return { ...output, newResourcePoints: newPoints };
  }
);
