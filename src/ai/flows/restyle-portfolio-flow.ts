
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Portfolio, AppConfiguration } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const AI_PORTFOLIO_RESTYLE_COST = 25;

const RestylePortfolioInputSchema = z.object({
  portfolioId: z.string(),
  userId: z.string(),
  prompt: z.string().min(5, "Please provide a more detailed restyling prompt."),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
export type RestylePortfolioInput = z.infer<typeof RestylePortfolioInputSchema>;

const RestylePortfolioOutputSchema = z.object({
  newHtmlContent: z.string().describe("The complete, new HTML content for the portfolio webpage, styled with Tailwind CSS."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
export type RestylePortfolioOutput = z.infer<typeof RestylePortfolioOutputSchema>;

export const restylePortfolioFlow = ai.defineFlow(
  {
    name: 'restylePortfolioFlow',
    inputSchema: RestylePortfolioInputSchema,
    outputSchema: RestylePortfolioOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, portfolioId, prompt, actorUid, actorName } = input;
    
    let actualCost = AI_PORTFOLIO_RESTYLE_COST;
    try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if (configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            actualCost = config.actionCosts?.find(c => c.key === 'AI_PORTFOLIO_GENERATION_COST')?.cost ?? AI_PORTFOLIO_RESTYLE_COST;
        }
    } catch(e) { console.warn("Could not fetch cost config for Portfolio Restyle."); }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found.");
    const userProfileData = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfileData.resourcePoints ?? 0;
    if (currentPoints < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    const portfolioRef = adminDb.collection('portfolios').doc(portfolioId);
    const portfolioSnap = await portfolioRef.get();
    if (!portfolioSnap.exists) throw new Error("Portfolio not found.");
    const portfolioData = portfolioSnap.data() as Portfolio;
    if (portfolioData.userId !== userId) throw new Error("Access denied to portfolio.");

    const promptText = `
        You are an expert web designer. Your task is to redesign the provided HTML for a portfolio webpage based on the user's request.
        You MUST return only the full, raw HTML content for the redesigned page.

        **CRITICAL RULES:**
        1.  **NO \`<html>\`, \`<head>\`, or \`<body>\` TAGS.** Your response MUST be a single block of HTML starting with the first \`<header>\` or \`<section>\` and ending with the final \`</footer>\`.
        2.  **RETAIN ALL EDITABLE AND SECTION TAGS.** All existing attributes like \`data-editable="true"\`, \`data-section-title="..."\`, and unique \`id\`s MUST be preserved on their respective elements. This is crucial for the editor to work.
        3.  **USE TAILWIND CSS ONLY.** Do not use custom CSS or \`<style>\` blocks.
        4.  **USE PLACEHOLDER \`[CONTACT_FORM]\`.** If a contact form exists, ensure it is represented only by the exact string \`[CONTACT_FORM]\`.

        **USER'S REDESIGN REQUEST:**
        "${prompt}"

        ---
        **EXISTING HTML CONTENT (to be redesigned):**
        \`\`\`html
        ${portfolioData.content}
        \`\`\`
        ---

        Now, generate the complete, redesigned HTML content based on the user's request and the existing content provided.
    `;
    
    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
      try {
        console.log(`Attempting portfolio restyle with model: ${modelName}`);
        response = await ai.generate({
          prompt: promptText,
          model: modelName as any,
          output: { schema: z.object({ newHtmlContent: z.string() }) },
          config: { temperature: 0.6 }
        });
        if (response && response.output) break;
      } catch (error: any) {
        console.warn(`Model ${modelName} failed for portfolio restyle. Error: ${error.message}`);
      }
    }

    if (!response || !response.output) {
      throw new Error("AI model failed to generate new portfolio style after trying all fallbacks.");
    }
    const { newHtmlContent } = response.output;

    await portfolioRef.update({
        content: newHtmlContent,
        updatedAt: new Date().toISOString(),
    });

    const newResourcePoints = currentPoints - actualCost;
    await userProfileRef.update({ resourcePoints: newResourcePoints });

    await logActivity({
      ownerId: userId,
      actorUid: actorUid || userId,
      actorName: actorName || userProfileData.fullName || 'User',
      actionType: 'portfolio_updated',
      entityType: 'Portfolio',
      entityId: portfolioId,
      entityName: portfolioData.portfolioName,
      details: { message: `AI restyled portfolio with prompt: "${prompt.substring(0, 50)}..."`, cost: actualCost }
    });

    return { newHtmlContent, newResourcePoints };
  }
);
