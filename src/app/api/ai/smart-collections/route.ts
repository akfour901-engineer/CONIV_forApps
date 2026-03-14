
import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Invoice, AppConfiguration } from '@/types/server-only';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { logActivity } from '@/lib/activityLog';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { FollowUpDraftSchema, SmartCollectionsOutputSchema } from '@/types/server-only';
import type { SmartCollectionsOutput } from '@/types/server-only';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
export const dynamic = 'force-dynamic';
const SmartCollectionsInputSchema = z.object({
  userId: z.string(),
  invoiceId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type SmartCollectionsInput = z.infer<typeof SmartCollectionsInputSchema>;

const smartCollectionsFlow = ai.defineFlow(
  {
    name: 'smartCollectionsFlow_api',
    inputSchema: SmartCollectionsInputSchema,
    outputSchema: SmartCollectionsOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, invoiceId, actorUid, actorName } = input;
    
    let actualCost = 15;
    try {
      const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if(configDoc.exists) {
          const config = configDoc.data() as AppConfiguration;
          const costConfig = config.actionCosts?.find((c) => c.key === 'AI_SMART_COLLECTIONS_COST');
          if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
      }
    } catch(e) { console.warn("Could not fetch cost config for Smart Collections."); }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
    const userProfileData = userProfileSnap.data() as UserProfile;
    if ((userProfileData.resourcePoints ?? 0) < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    const invoiceSnap = await adminDb.collection('invoices').doc(invoiceId).get();
    if (!invoiceSnap.exists) throw new Error("Invoice not found.");
    const invoice = invoiceSnap.data() as Invoice;
    if (invoice.userId !== userId) throw new Error("Access denied to this invoice.");
    
    const promptText = `You are a polite but firm collections agent for a contracting business. Draft a professional follow-up email for an overdue invoice.
    
    **Invoice Details:**
    - Invoice Number: ${invoice.invoiceNumber}
    - Client: ${invoice.organizationName}
    - Due Date: ${format(new Date(invoice.dueDate), 'dd MMM yyyy')}
    - Amount Due: ${formatCurrency(invoice.balanceDue)}
    
    **Your Task:**
    1.  Generate a concise, professional 'subject' line for the email.
    2.  Generate a 'body' for the email. Be polite, reference the invoice number and due date, state the amount due, and ask when payment can be expected. Do not include a sign-off, just the body content.
    `;
    
    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema: FollowUpDraftSchema },
            });
            if (response && response.output) break;
        } catch(e: any) {
            console.warn(`Model ${modelName} failed for smart collections. Error: ${e.message}`);
        }
    }

    if(!response || !response.output) throw new Error("AI failed to generate a draft after all fallbacks.");
    const output = response.output;

    const newResourcePoints = (userProfileData.resourcePoints ?? 0) - actualCost;
    await userProfileRef.update({ resourcePoints: newResourcePoints });
    
    await logActivity({
      ownerId: userId, actorUid: actorUid || userId, actorName: actorName || "AI User",
      actionType: 'audit_run', entityType: 'AI', entityName: `AI Collections Draft for Inv#${invoice.invoiceNumber}`, details: { cost: actualCost }
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
