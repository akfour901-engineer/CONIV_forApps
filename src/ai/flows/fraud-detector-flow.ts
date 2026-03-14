
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, ActivityLog, AppConfiguration, FraudAnalysisOutput } from '@/types/server-only';
import { FraudAnalysisOutputSchema } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export const FraudAnalysisInputSchema = z.object({
  dataOwnerId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
export type FraudAnalysisInput = z.infer<typeof FraudAnalysisInputSchema>;

const FraudAnalysisPromptDataSchema = z.object({
    activityLogs: z.string(),
});
type FraudAnalysisPromptData = z.infer<typeof FraudAnalysisPromptDataSchema>;

const SuspiciousActivitySchema = z.object({
    description: z.string().describe("A clear and concise description of the suspicious activity."),
    reason: z.string().describe("The specific reason why this activity is flagged as suspicious."),
    activityLogId: z.string().optional().describe("The ID of the related activity log entry, if applicable."),
});
export type SuspiciousActivity = z.infer<typeof SuspiciousActivitySchema>;


const analyzeFraudPrompt = (promptData: FraudAnalysisPromptData) => `You are an expert fraud detection analyst for a SaaS platform. Your task is to review a company's activity log to identify suspicious patterns that could indicate internal fraud or unauthorized access.

Analyze the following activity log summary. Look for patterns such as:
- Rapid creation and deletion of important documents (Invoices, WOs).
- Multiple failed login attempts followed by a success.
- Logins from multiple, distinct locations or devices in a short period.
- Permission changes for users, especially granting high-level access.
- Unusual data export activity.
- Deletion of multiple high-value items in a row.

**Activity Log Data (most recent events first):**
${promptData.activityLogs}

**Your Analysis Task:**
1.  **Analysis Summary:** Provide a short paragraph summarizing your findings. Mention if the activity appears normal or if there are red flags.
2.  **Risk Score:** Assign a score from 0-100, where 0 is no risk and 100 is a very high likelihood of fraudulent activity.
3.  **Suspicious Activities:** List each specific activity you deem suspicious. For each, provide a description and the reason it was flagged.
4.  **Recommendations:** Based on your findings, provide clear, actionable recommendations for the account owner.
`;

const fraudDetectorFlow = ai.defineFlow(
  {
    name: 'fraudDetectorFlow_api',
    inputSchema: FraudAnalysisInputSchema,
    outputSchema: FraudAnalysisOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      const { dataOwnerId, actorUid, actorName } = input;
      
      const DEFAULT_COST = 50; 
      let actualCost = DEFAULT_COST;
      try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if(configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find(c => c.key === 'AI_AUDIT_TOOL_BASE_COST'); // Re-using audit cost
            if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
      } catch(e) { console.warn("Could not fetch cost config for Fraud Detector."); }

      const userProfileRef = adminDb.collection('users').doc(dataOwnerId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
      const userProfileData = userProfileSnap.data() as UserProfile;
      if ((userProfileData.resourcePoints ?? 0) < actualCost) {
        throw new Error(`Insufficient resource points. You need ${actualCost}.`);
      }

      const logsSnap = await adminDb.collection('activityLogs')
        .where('ownerId', '==', dataOwnerId)
        .orderBy('timestamp', 'desc')
        .limit(500)
        .get();
      
      const activityLogs = logsSnap.docs.map(doc => {
          const log = doc.data() as ActivityLog;
          return `- ${log.timestamp}: ${log.actorName} performed '${log.actionType}' on ${log.entityType} ${log.entityName || ''}. Details: ${typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}`;
      }).join('\n');
      
      if(logsSnap.empty) {
        return {
            analysisSummary: "No activity data available to analyze. The system is secure as no actions have been logged.",
            riskScore: 0,
            suspiciousActivities: [],
            recommendations: "Start using the app to generate activity data.",
            newResourcePoints: userProfileData.resourcePoints,
        };
      }

      const promptText = analyzeFraudPrompt({ activityLogs });
      
      let response;
      const schema = FraudAnalysisOutputSchema.omit({ newResourcePoints: true, error: true });
      for(const modelName of MODEL_FALLBACK_LIST) {
        try {
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema },
            });
            if(response?.output) break;
        } catch(e: any) {
            console.warn(`Fraud detector model ${modelName} failed`, e.message);
        }
      }
      
      if (!response?.output) throw new Error("AI model did not return a valid analysis after trying all fallbacks.");

      const output = response.output;

      const newResourcePoints = (userProfileData.resourcePoints ?? 0) - actualCost;
      await userProfileRef.update({ resourcePoints: newResourcePoints });
      
      await logActivity({
          ownerId: dataOwnerId,
          actorUid: actorUid || dataOwnerId,
          actorName: actorName || userProfileData.fullName || "User",
          actionType: 'audit_run',
          entityType: 'AI',
          entityName: `AI Fraud Detection Scan`,
          details: { cost: actualCost, riskScore: output.riskScore }
      });
      
      return { ...output, newResourcePoints };
  }
);


export async function runFraudAnalysis(input: FraudAnalysisInput): Promise<FraudAnalysisOutput> {
    return await fraudDetectorFlow(input);
}
