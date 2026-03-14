
'use server';

import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Company, WorkOrder, BidAdvisorOutput } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { AI_BID_ADVISOR_COST } from '@/lib/constants';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const BidAdvisorInputSchema = z.object({
  userId: z.string(),
  companyId: z.string(),
  tenderDetails: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
export type BidAdvisorInput = z.infer<typeof BidAdvisorInputSchema>;

export const runBidAdvisorFlow = ai.defineFlow(
  {
    name: 'runBidAdvisorFlow_api',
    inputSchema: BidAdvisorInputSchema,
    outputSchema: z.custom<BidAdvisorOutput>(),
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, companyId, tenderDetails, actorUid, actorName } = input;

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found.");
    const userProfile = userProfileSnap.data() as UserProfile;
    
    if ((userProfile.resourcePoints ?? 0) < AI_BID_ADVISOR_COST) {
        throw new Error(`Insufficient resource points. You need ${AI_BID_ADVISOR_COST}.`);
    }

    const [companySnap, workOrdersSnap] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('workOrders').where('userId', '==', userId).where('companyId', '==', companyId).limit(50).get()
    ]);

    if (!companySnap.exists) throw new Error("Company not found.");
    const company = companySnap.data() as Company;
    
    const companySummary = `Company Name: ${company.name}, Type: ${company.companyType}, Description: ${company.description || 'N/A'}`;
    const projectHistory = workOrdersSnap.docs.map(doc => {
      const wo = doc.data() as WorkOrder;
      return `- Scope: ${wo.scopeOfWork}, Value: ${wo.grandTotal}, Status: ${wo.status}`;
    }).join('\n');

    const promptText = `
      You are a construction project bidding expert. Analyze the following tender against the company's profile and project history.

      **Tender Details:**
      ${tenderDetails}

      ---
      **Company Profile:**
      ${companySummary}

      ---
      **Recent Project History (up to 50 projects):**
      ${projectHistory || "No projects found."}
      
      ---
      **Your Task:**
      1.  **Recommendation Score:** Provide a score (0-100) indicating how good of a fit this tender is for the company.
      2.  **Recommendation:** Give a clear 'Strongly Recommend', 'Recommend', 'Neutral', 'Caution Advised', or 'Do Not Recommend' verdict.
      3.  **Reasoning:** Justify your recommendation with specific links between the tender requirements and the company's experience and profile.
      4.  **Pros:** List 3-5 key reasons why the company SHOULD bid.
      5.  **Cons:** List 3-5 key risks or weaknesses the company has for this bid.
    `;
    
    let response;
    const schema = z.object({
      recommendationScore: z.number(),
      recommendation: z.enum(['Strongly Recommend', 'Recommend', 'Neutral', 'Caution Advised', 'Do Not Recommend']),
      reasoning: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    });
    
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting bid advisor with model: ${modelName}`);
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema },
            });
            if (response?.output) {
                console.log(`Bid advisor success with model: ${modelName}`);
                break;
            }
        } catch (error: any) {
            console.warn(`Model ${modelName} failed for bid advisor. Error: ${error.message}`);
        }
    }
    
    if (!response || !response.output) throw new Error('AI failed to provide an analysis after trying all fallbacks.');
    const output = response.output;
    
    const newResourcePoints = (userProfile.resourcePoints ?? 0) - AI_BID_ADVISOR_COST;
    await userProfileRef.update({ resourcePoints: newResourcePoints });

    await logActivity({
      ownerId: userId, actorUid: actorUid || userId, actorName: actorName || "User",
      actionType: 'audit_run', entityType: 'AI', entityName: 'Bid Advisor',
      details: { cost: AI_BID_ADVISOR_COST }
    });

    return { ...output, newResourcePoints };
  }
);

export async function runBidAdvisor(input: BidAdvisorInput): Promise<BidAdvisorOutput> {
  return await runBidAdvisorFlow(input);
}
