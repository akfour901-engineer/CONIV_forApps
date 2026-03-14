import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Invoice, WorkOrder, AppConfiguration, AlertItem } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { formatDistanceToNowStrict, parseISO, addDays, isBefore, startOfToday } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { AI_DAILY_BRIEFING_COST } from '@/lib/constants';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const GetDailyBriefingInputSchema = z.object({
  userId: z.string(),
});

const GetDailyBriefingOutputSchema = z.object({
  greeting: z.string().describe("A friendly and professional greeting for the user."),
  priorityTasks: z.array(z.string()).describe("A list of the most urgent tasks for the day, formatted in markdown."),
  summary: z.string().describe("A concise paragraph summarizing the key items for the day."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
export type GetDailyBriefingOutput = z.infer<typeof GetDailyBriefingOutputSchema>;

const getDailyBriefingFlow = ai.defineFlow(
  {
    name: 'getDailyBriefingFlow',
    inputSchema: GetDailyBriefingInputSchema,
    outputSchema: GetDailyBriefingOutputSchema,
  },
  async ({ userId }) => {
    const adminDb = getDb();
    let actualCost = AI_DAILY_BRIEFING_COST;
    try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if (configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find(c => c.key === 'AI_DAILY_BRIEFING_COST');
            if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
    } catch (e) { console.warn("Could not fetch cost config for Daily Briefing."); }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found.");
    
    const userProfile = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfile.resourcePoints ?? 0;
    if (currentPoints < actualCost) {
        throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    const today = startOfToday();
    const oneWeekFromNow = addDays(today, 7);

    // Fetch data for briefing
    // Note: Removed orderBy from alerts query to avoid requiring a composite index. Sorting is handled in-memory below.
    const [invoicesSnap, workOrdersSnap, alertsSnap] = await Promise.all([
        adminDb.collection('invoices').where('userId', '==', userId).where('status', 'in', ['unpaid', 'overdue', 'partially-paid']).get(),
        adminDb.collection('workOrders').where('userId', '==', userId).where('status', '==', 'in-progress').get(),
        adminDb.collection('alerts').where('userId', '==', userId).get(),
    ]);

    const overdueInvoices = invoicesSnap.docs.map(d => d.data() as Invoice).filter(inv => isBefore(parseISO(inv.dueDate), today));
    const dueSoonWOs = workOrdersSnap.docs.map(d => d.data() as WorkOrder).filter(wo => isBefore(parseISO(wo.endDate), oneWeekFromNow));
    
    const allAlerts = alertsSnap.docs.map(d => d.data() as AlertItem);
    const recentAlerts = allAlerts
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        .slice(0, 10);

    // Construct prompt
    const userName = userProfile.fullName || 'User';
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let context = `Date: ${date}\nUser: ${userName}\n`;
    context += `Overdue Invoices (${overdueInvoices.length}):\n${overdueInvoices.slice(0,3).map(inv => `- Inv #${inv.invoiceNumber} for ${inv.organizationName} (${formatCurrency(inv.balanceDue)})`).join('\n')}\n`;
    context += `Work Orders Due Soon (${dueSoonWOs.length}):\n${dueSoonWOs.slice(0,3).map(wo => `- WO #${wo.workOrderNumber} for ${wo.organizationName} ends in ${formatDistanceToNowStrict(parseISO(wo.endDate))}`).join('\n')}\n`;
    context += `Recent High-Priority Alerts (${recentAlerts.length}):\n${recentAlerts.slice(0,3).map(a => `- ${a.title}: ${a.description}`).join('\n')}\n`;

    const prompt = `You are a helpful executive assistant. Based on the provided context, generate a personalized daily briefing for a construction contractor.
    
    Context:
    ${context}
    
    Tasks:
    1.  Start with a professional but friendly greeting to the user.
    2.  Create a "Priority Tasks" list of 3-5 of the most urgent and important items. Use markdown for a bulleted list. Each item should be actionable.
    3.  Write a "Daily Summary" paragraph that gives a high-level overview of the day's focus, mentioning the number of overdue items or upcoming deadlines.
    `;
    
    let response;
    const schema = GetDailyBriefingOutputSchema.omit({ newResourcePoints: true, error: true });
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            response = await ai.generate({
                prompt,
                model: modelName as any,
                output: { schema },
                config: { temperature: 0.3 }
            });
            if(response?.output) break;
        } catch (e: any) {
            console.warn(`Daily briefing model ${modelName} failed`, e.message);
        }
    }
    
    if (!response?.output) throw new Error("AI failed to generate a briefing after trying all fallbacks.");
    
    const output = response.output;
    
    const newResourcePoints = currentPoints - actualCost;
    await userProfileRef.update({ resourcePoints: newResourcePoints });

    await logActivity({
        ownerId: userId,
        actorUid: userId,
        actorName: userName,
        actionType: 'ai_daily_briefing',
        entityType: 'AI',
        entityName: 'Daily Briefing',
        details: { message: `Generated daily briefing.`, cost: actualCost }
    });

    return { ...output, newResourcePoints };
  }
);


export async function getDailyBriefing(input: { userId: string }): Promise<GetDailyBriefingOutput> {
  return await getDailyBriefingFlow(input);
}
