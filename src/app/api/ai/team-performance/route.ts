
import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration, ActivityLog } from '@/types/server-only';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { PerformanceOutputSchema } from '@/types/server-only';
import type { TeamPerformanceOutput } from '@/types/server-only';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
export const dynamic = 'force-dynamic';
const TeamPerformanceInputSchema = z.object({
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type TeamPerformanceInput = z.infer<typeof TeamPerformanceInputSchema>;

const PerformancePromptDataSchema = z.object({
    activityLogSummary: z.string(),
});
type PerformancePromptData = z.infer<typeof PerformancePromptDataSchema>;

const analyzePerformancePromptText = `You are an operations analyst for a contracting business. Your task is to analyze the provided activity log summary to identify team performance metrics, top performers, and operational bottlenecks.

**Activity Log Summary (recent 200 actions):**
{{{activityLogSummary}}}

---

**Your Analysis Task:**
1.  **Efficiency Summary:** Briefly describe the team's overall activity. What are the most common actions? Are there specific days or times with high activity?
2.  **Top Performers:** Identify 2-3 top-performing individuals based on the volume and significance of their actions (e.g., creating estimates, completing work orders). For each, list their name, activity count, and a brief summary of their key contributions.
3.  **Bottleneck Analysis:** Look for patterns that suggest delays. For example, if many estimates are created but few are converted to work orders, or if work orders stay "in-progress" for long periods. Identify and describe these potential bottlenecks.
`;

const teamPerformanceFlow = ai.defineFlow(
  {
    name: 'teamPerformanceFlow_api',
    inputSchema: TeamPerformanceInputSchema,
    outputSchema: PerformanceOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      const { userId, actorUid, actorName } = input;
      
      const DEFAULT_COST = 50; 
      let actualCost = DEFAULT_COST;
      try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if(configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find(c => c.key === 'AI_TEAM_PERFORMANCE_COST');
            if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
      } catch(e) { console.warn("Could not fetch cost config for Team Performance Analysis."); }
      
      const userProfileRef = adminDb.collection('users').doc(userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
      const userProfileData = userProfileSnap.data() as UserProfile;
      if ((userProfileData.resourcePoints ?? 0) < actualCost) {
        throw new Error(`Insufficient resource points. You need ${actualCost}.`);
      }

      const logsSnap = await adminDb.collection('activityLogs')
        .where('ownerId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();

      if (logsSnap.empty) {
        return {
            efficiencySummary: "No activity data available to analyze.",
            topPerformers: [],
            bottleneckAnalysis: "Not enough data for bottleneck analysis.",
            newResourcePoints: userProfileData.resourcePoints,
        };
      }
      
      const activityLogSummary = logsSnap.docs.map(doc => {
          const log = doc.data() as ActivityLog;
          return `- ${log.timestamp}: ${log.actorName} performed '${log.actionType}' on ${log.entityType} ${log.entityName || ''}`;
      }).join('\\n');


      const promptText = analyzePerformancePromptText.replace('{{{activityLogSummary}}}', activityLogSummary);
      
      let response;
      const schema = PerformanceOutputSchema.omit({newResourcePoints: true, error: true});
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            const { output } = await ai.generate({
              prompt: promptText,
              model: modelName as any,
            });
            if (output) {
                response = schema.parse(output);
                console.log(`Success with model: ${modelName}`);
                break;
            }
        } catch (e: any) {
            console.warn(`Model ${modelName} failed for team performance analysis. Error: ${e.message}`);
        }
      }

      if (!response) {
        throw new Error("AI model did not return a valid analysis after trying all fallbacks.");
      }

      const output = response;
      
      const newResourcePoints = Math.round((userProfileData.resourcePoints ?? 0) - actualCost);
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: userId,
          actorUid: actorUid || userId,
          actorName: actorName || userProfileData.fullName || "User",
          actionType: 'audit_run',
          entityType: 'AI',
          entityName: `AI Team Performance Analysis`,
          details: { cost: actualCost, message: "AI Team Performance analysis was run." }
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
    
    const input: TeamPerformanceInput = await request.json();

    if (decodedToken.uid !== input.actorUid) {
        return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }
    
    const result = await teamPerformanceFlow(input);
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error in /api/ai/team-performance:`, error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
