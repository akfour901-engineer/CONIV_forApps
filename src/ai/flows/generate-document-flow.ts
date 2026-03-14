'use server';
/**
 * @fileOverview A flow to generate letters and certificates.
 * This flow uses a generative AI model to create documents based on user input.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration } from '@/types/server-only';
import { DocumentGenerationInputSchema, DocumentGenerationOutputSchema } from '@/types/server-only';
import type { DocumentGenerationInput, DocumentGenerationOutput } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { LETTER_CERTIFICATE_GENERATION_COST } from '@/lib/constants';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

// Exporting types for use in other server-side components
export type { DocumentGenerationInput, DocumentGenerationOutput };

const generateDocumentFlow = ai.defineFlow(
  {
      name: 'generateDocumentFlow',
      inputSchema: DocumentGenerationInputSchema,
      outputSchema: DocumentGenerationOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    let actualCost = LETTER_CERTIFICATE_GENERATION_COST;
    try {
      const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if (configDoc.exists) {
        const config = configDoc.data() as AppConfiguration;
        const costConfig = config.actionCosts?.find((c: any) => c.key === 'LETTER_CERTIFICATE_GENERATION_COST');
        if (costConfig?.cost !== undefined) {
          actualCost = costConfig.cost;
        }
      }
    } catch (e) {
      console.warn("Could not fetch cost config for Letter/Certificate Generation.");
    }
    
    const userProfileRef = adminDb.collection('users').doc(input.userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found.");
    const userProfile = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.`);
    }

    let promptText = `You are an expert at drafting professional business documents. Your task is to generate a ${input.documentType} based on the user's requirements.\n\nDocument Type: ${input.documentType}\nRecipient: ${input.recipient}\nSubject / Title: ${input.subject}\n\nMain Context & Purpose:\n${input.context}\n\n`;

    if (input.customFields && input.customFields.length > 0) {
        promptText += 'Key Information to Include:\n';
        input.customFields.forEach(field => {
            promptText += `- ${field.key}: ${field.value}\n`;
        });
    }

    promptText += "\nPlease generate the complete document content. The output should be a well-formatted markdown document. Ensure the tone is professional and appropriate for the specified document type.\nGenerate a suitable title for the document, which can be the same as the provided subject.\n";
    
    let response;
    const schema = DocumentGenerationOutputSchema.pick({title: true, content: true});

    for (const modelName of MODEL_FALLBACK_LIST) {
      try {
        console.log(`Attempting document generation with model: ${modelName}`);
        const { output } = await ai.generate({
            prompt: promptText,
            model: modelName as any,
            output: { schema },
            config: { temperature: 0.3 }
        });

        if (output) {
            response = schema.parse(output);
            console.log(`Success with model: ${modelName}`);
            break;
        }
      } catch (error: any) {
        console.warn(`Model ${modelName} failed for document generation. Error: ${error.message}`);
      }
    }

    if (!response) {
      throw new Error("AI model did not return a valid document after trying all fallbacks.");
    }
    const output = response;

    const newResourcePoints = currentPoints - actualCost;
    await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });

    await logActivity({
      ownerId: input.userId,
      actorUid: input.userId, // Assuming the user is the actor
      actorName: userProfile.fullName || userProfile.email || "User",
      actionType: 'letter_generation',
      entityType: 'AI',
      entityName: `Generated ${input.documentType}: ${input.subject}`,
      details: { message: `AI generated a ${input.documentType}.`, cost: actualCost }
    });
    
    return { ...output, newResourcePoints };
  }
);


export async function generateDocument(input: DocumentGenerationInput): Promise<DocumentGenerationOutput> {
  return await generateDocumentFlow(input);
}
