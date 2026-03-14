
'use server';

import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Invoice, AppConfiguration } from '@/types/server-only';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';

const SmartCollectionsInputSchema = z.object({
  invoiceId: z.string(),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type SmartCollectionsInput = z.infer<typeof SmartCollectionsInputSchema>;

const FollowUpDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});
type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;

const SmartCollectionsOutputSchema = z.object({
  draft: FollowUpDraftSchema,
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
type SmartCollectionsOutput = z.infer<typeof SmartCollectionsOutputSchema>;

const MODEL_FALLBACK_LIST = [
    'googleai/gemini-2.0-flash',
    'googleai/gemini-2.5-flash',
    'googleai/gemini-2.5-pro',
    'googleai/gemini-2.0-flash-lite',
    'googleai/gemini-2.5-flash-lite',
];

const smartCollectionsFlow = ai.defineFlow(
  {
    name: 'smartCollectionsFlow_api',
    inputSchema: SmartCollectionsInputSchema,
    outputSchema: SmartCollectionsOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      const { userId, invoiceId, actorUid, actorName } = input;
      
      const DEFAULT_COST = 10;
      let actualCost = DEFAULT_COST;
      try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if(configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find(c => c.key === 'AI_SMART_COLLECTIONS_COST');
            if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
      } catch(e) { console.warn("Could not fetch cost config for Smart Collections."); }

      const userProfileRef = adminDb.collection('users').doc(userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
      const userProfileData = userProfileSnap.data() as UserProfile;
      const currentPoints = userProfileData.resourcePoints ?? 0;
      if (currentPoints < actualCost) {
        throw new Error(`Insufficient resource points. You need ${actualCost}.`);
      }
      
      const invoiceSnap = await adminDb.collection('invoices').doc(invoiceId).get();
      if (!invoiceSnap.exists || invoiceSnap.data()?.userId !== userId) {
          throw new Error('Invoice not found or access denied.');
      }
      const invoice = invoiceSnap.data() as Invoice;
      const invoiceDetails = `Invoice #: ${invoice.invoiceNumber}, Client: ${invoice.organizationName}, Amount Due: ${invoice.balanceDue}, Due Date: ${invoice.dueDate}.`;

      const prompt = `You are an accounts receivable specialist. Your task is to draft a professional but firm follow-up email for an overdue invoice.
Use the provided invoice details to personalize the email. Keep it concise.

**Invoice Details:**
${invoiceDetails}

---
Generate a subject line and email body. The tone should be professional, courteous, but clear about the payment being overdue.
`;
      
      let response;
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            response = await ai.generate({
                prompt: prompt,
                model: modelName as any,
                output: { schema: FollowUpDraftSchema },
            });
            if (response) {
                console.log(`Success with model: ${modelName}`);
                break;
            }
        } catch (e: any) {
            console.warn(`Model ${modelName} failed for smart collections. Error: ${e.message}`);
        }
      }
      
      if (!response || !response.output) {
        throw new Error("AI model did not return a valid draft after trying all fallbacks.");
      }
      
      const output = response.output;
      
      const newResourcePoints = Math.round((userProfileData.resourcePoints ?? 0) - actualCost);
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: userId,
          actorUid: actorUid || userId,
          actorName: actorName || userProfileData.fullName || "User",
          actionType: 'audit_run',
          entityType: 'AI',
          entityName: `AI Follow-up Draft for Inv: ${invoice.invoiceNumber}`,
          details: { cost: actualCost, message: `Generated an AI follow-up draft for Invoice #${invoice.invoiceNumber}.` }
      });
      
      return { draft: output, newResourcePoints };
  }
);


export async function POST(request: Request) {
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const input: SmartCollectionsInput = await request.json();

    if (decodedToken.uid !== input.actorUid) {
        return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }
    
    const result = await smartCollectionsFlow(input);

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error in /api/ai/smart-collections:`, error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
