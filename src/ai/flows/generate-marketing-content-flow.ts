'use server';

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { Company, UserProfile, MailingListContent, AppConfiguration } from '@/types/server-only';
import { GenerateMarketingContentInputSchema, GenerateMarketingContentOutputSchema as BaseOutputSchema } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { AI_MARKETING_CONTENT_GENERATION_COST } from '@/lib/constants';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const GenerateMarketingContentOutputSchema = BaseOutputSchema.extend({
  newResourcePoints: z.number().optional(),
  contentId: z.string().optional(),
});

export type GenerateMarketingContentInput = z.infer<typeof GenerateMarketingContentInputSchema>;
export type GenerateMarketingContentOutput = z.infer<typeof GenerateMarketingContentOutputSchema>;

const generateMarketingContentFlow = ai.defineFlow(
  {
    name: 'generateMarketingContentFlow',
    inputSchema: GenerateMarketingContentInputSchema,
    outputSchema: GenerateMarketingContentOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, prompt, contentName, companyId, products, isRegeneration, contentIdToUpdate } = input;

    let actualCost = AI_MARKETING_CONTENT_GENERATION_COST;
    try {
      const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if (configDoc.exists) {
        const configData = configDoc.data() as AppConfiguration;
        const costConfig = configData.actionCosts?.find((c: any) => c.key === 'AI_MARKETING_CONTENT_GENERATION_COST');
        if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
      }
    } catch (e) {
      console.warn("Could not fetch cost config for AI Marketing Content Generation.");
    }
    
    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found.");
    const userProfile = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    let companyContext = "";
    if (companyId) {
        const companySnap = await adminDb.collection('companies').doc(companyId).get();
        if (companySnap.exists) {
            const companyData = companySnap.data() as Company;
            companyContext = `\n\n**Company Information for Context:**\nName: ${companyData.name}\nDescription: ${companyData.description || 'N/A'}\nServices: (Infer from prompt or use product list)`;
        }
    }
    
    let productContext = "";
    if (products && products.length > 0) {
        productContext = "\n\n**Featured Products/Services:**\n" + products.map(p => `- **${p.name}:** ${p.description}`).join("\n");
    }

    const fullPrompt = `You are an expert marketing copywriter for small and medium-sized businesses. Your task is to generate a compelling and professional email campaign based on the user's prompt.

**CRITICAL INSTRUCTIONS:**
1. Generate a concise, engaging 'subject' line for the email.
2. Generate the 'htmlContent' for the email body.
3. Use placeholders like '{{MEMBER_NAME}}' for personalization.
4. **DO NOT** use markdown for the HTML body. Use actual HTML tags like \`<h1>\`, \`<p>\`, \`<strong>\`, \`<ul>\`, \`<li>\`, and inline styles for basic formatting.
5. The entire output must be a single, valid JSON object matching the requested schema.

---
**User's Prompt:**
"${prompt}"
${companyContext}
${productContext}
---

Now, generate the JSON object with the 'subject' and 'htmlContent'.`;
    
    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting marketing content generation with model: ${modelName}`);
            const { output } = await ai.generate({
                prompt: fullPrompt,
                model: modelName as any,
                output: { schema: BaseOutputSchema },
            });
            if (output) {
              response = output;
              break;
            }
        } catch (e) {
            console.warn(`Model ${modelName} failed, trying next...`);
        }
    }

    if (!response) {
      throw new Error("AI model failed to generate content after trying all fallbacks.");
    }
    const output = response;

    const newResourcePoints = currentPoints - actualCost;
    let finalContentId = contentIdToUpdate;
    
    const now = new Date().toISOString();
    const batch = adminDb.batch();

    const contentData: Omit<MailingListContent, 'id'> = {
      userId,
      contentName,
      subject: output.subject,
      htmlContent: output.htmlContent,
      createdAt: isRegeneration && contentIdToUpdate ? (await adminDb.collection('mailingListContent').doc(contentIdToUpdate).get()).data()?.createdAt : now,
      updatedAt: now,
      companyId: companyId || null,
      prompt: prompt,
    };
    
    if (isRegeneration && contentIdToUpdate) {
        const docRef = adminDb.collection('mailingListContent').doc(contentIdToUpdate);
        batch.update(docRef, contentData);
    } else {
        const docRef = adminDb.collection('mailingListContent').doc();
        batch.set(docRef, contentData);
        finalContentId = docRef.id;
    }

    batch.update(userProfileRef, { resourcePoints: newResourcePoints, resourcePointsLastUpdated: now });
    await batch.commit();

    await logActivity({
      ownerId: userId,
      actorUid: userId,
      actorName: userProfile.fullName || "User",
      actionType: 'ai_marketing_content',
      entityType: 'MailingListContent',
      entityId: finalContentId,
      entityName: contentName,
      details: { message: `AI generated marketing content: "${contentName}"`, cost: actualCost }
    });

    return { ...output, contentId: finalContentId, newResourcePoints };
  }
);

export async function generateMarketingContent(
  input: GenerateMarketingContentInput
): Promise<GenerateMarketingContentOutput> {
  return generateMarketingContentFlow(input);
}
