
'use server';

import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Company, WorkOrder, License, AppConfiguration } from '@/types/server-only';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';

const BidAdvisorInputSchema = z.object({
  tenderDetails: z.string().min(50, "Tender details must be provided."),
  companyId: z.string(),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type BidAdvisorInput = z.infer<typeof BidAdvisorInputSchema>;

const BidAdvisorPromptDataSchema = z.object({
    tenderDetails: z.string(),
    companyProfile: z.string(),
    pastProjectsSummary: z.string(),
    licensesSummary: z.string(),
});
type BidAdvisorPromptData = z.infer<typeof BidAdvisorPromptDataSchema>;

const AIModelOutputSchema = z.object({
  recommendationScore: z.number().min(0).max(100).describe("A score from 0 to 100 indicating the match/advisability of bidding."),
  recommendation: z.enum(['Strongly Recommend', 'Recommend', 'Neutral', 'Caution Advised', 'Do Not Recommend']).describe("A clear recommendation category."),
  reasoning: z.string().describe("A detailed explanation for the recommendation, citing specific data points from the company's profile and project history vs. the tender requirements."),
  pros: z.array(z.string()).describe("A list of strengths or reasons FOR bidding."),
  cons: z.array(z.string()).describe("A list of weaknesses, risks, or reasons AGAINST bidding."),
});

const BidAdvisorOutputSchema = AIModelOutputSchema.extend({
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
type BidAdvisorOutput = z.infer<typeof BidAdvisorOutputSchema>;

const MODEL_FALLBACK_LIST = [
    'googleai/gemini-2.0-flash',
    'googleai/gemini-2.5-flash',
    'googleai/gemini-2.5-pro',
    'googleai/gemini-2.0-flash-lite',
    'googleai/gemini-2.5-flash-lite',
];

const bidAdvisorPrompt = (promptData: BidAdvisorPromptData) => `You are an expert bid manager and risk analyst for construction and contracting companies. Your task is to analyze a new tender against a company's profile, past projects, and available licenses to provide a clear "Bid / No-Bid" recommendation.

**Tender Details:**
${promptData.tenderDetails}

---

**Company Profile & History:**
**Profile:** ${promptData.companyProfile}
**Past Projects Summary:** ${promptData.pastProjectsSummary}
**Available Licenses:** ${promptData.licensesSummary}

---

**Your Analysis Task:**
1.  **Compare** the tender's requirements (scope, scale, eligibility criteria) against the company's capabilities and experience.
2.  **Assess** the alignment. Does the company have a proven track record in similar work? Are there any red flags or missing prerequisites (e.g., certifications, financial turnover)?
3.  **Synthesize** your findings into a concise, actionable recommendation.
4.  **Calculate a Recommendation Score** from 0 (terrible match) to 100 (perfect match).
5.  **Provide a clear Recommendation Category** from the available options.
6.  **Justify** your score and recommendation with specific reasoning, listing the pros and cons by directly referencing the provided data.
`;

const bidAdvisorFlow = ai.defineFlow(
  {
    name: 'bidAdvisorFlow_api',
    inputSchema: BidAdvisorInputSchema,
    outputSchema: BidAdvisorOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      const { userId, companyId, tenderDetails, actorUid, actorName } = input;
      
      const DEFAULT_COST = 50; 
      let actualCost = DEFAULT_COST;
      try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if(configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find(c => c.key === 'AI_BID_ADVISOR_COST');
            if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
      } catch(e) { console.warn("Could not fetch cost config for Bid Advisor."); }
      

      const userProfileRef = adminDb.collection('users').doc(userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
      const userProfileData = userProfileSnap.data() as UserProfile;
      const currentPoints = userProfileData.resourcePoints ?? 0;
      if (currentPoints < actualCost) {
        throw new Error(`Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.`);
      }

      // Fetch Company, Work Orders, and Licenses
      const [companySnap, workOrdersSnap, licensesSnap] = await Promise.all([
        adminDb.collection('companies').doc(companyId).get(),
        adminDb.collection('workOrders').where('userId', '==', userId).where('companyId', '==', companyId).limit(20).get(),
        adminDb.collection('licenses').where('userId', '==', userId).where('companyId', '==', companyId).get(),
      ]);

      if (!companySnap.exists) throw new Error("Company not found.");
      const company = companySnap.data() as Company;

      const companyProfile = `Name: ${company.name}, Type: ${company.companyType}, Description: ${company.description}`;
      const pastProjectsSummary = workOrdersSnap.docs.map(doc => {
          const wo = doc.data() as WorkOrder;
          return `- WO#${wo.workOrderNumber}: ${wo.scopeOfWork?.substring(0, 100)}... (Value: ${wo.grandTotal})`;
      }).join('\n') || "No relevant past projects found.";
      const licensesSummary = licensesSnap.docs.map(doc => {
          const lic = doc.data() as License;
          return `- ${lic.licenseName} (${lic.licenseType}) - Expires: ${lic.expiryDate}`;
      }).join('\n') || "No licenses on record for this company.";

      const promptData: BidAdvisorPromptData = {
          tenderDetails,
          companyProfile,
          pastProjectsSummary,
          licensesSummary
      };
      
      const promptText = bidAdvisorPrompt(promptData);
      
      let response;
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema: AIModelOutputSchema },
            });
            if (response) {
                console.log(`Success with model: ${modelName}`);
                break;
            }
        } catch (e: any) {
            console.warn(`Model ${modelName} failed for bid advisor. Error: ${e.message}`);
        }
      }
      
      if (!response || !response.output) {
        throw new Error("AI model did not return a valid analysis after trying all fallbacks.");
      }

      const output = response.output;

      const newResourcePoints = Math.round(currentPoints - actualCost);
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: userId,
          actorUid: actorUid || userId,
          actorName: actorName || userProfileData.fullName || "User",
          actionType: 'ai_risk_assessment',
          entityType: 'AI',
          entityName: `Bid Advisor Analysis for ${company.name}`,
          details: { cost: actualCost, message: `AI Bid Advisor run for company ${company.name}. Tender: ${tenderDetails.substring(0, 50)}...` }
      });
      
      return { ...output, newResourcePoints };
  }
);


export async function POST(request: Request) {
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const input: BidAdvisorInput = await request.json();

    if (decodedToken.uid !== input.actorUid) {
        return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }
    
    const result = await bidAdvisorFlow(input);

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error in /api/ai/bid-advisor:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = (error as any).status || 500;
    return NextResponse.json({ error: errorMessage, details: errorMessage }, { status });
  }
}
