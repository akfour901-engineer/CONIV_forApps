'use server';
/**
 * @fileOverview A flow to generate a project schedule (Gantt chart tasks) from a work order.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { WorkOrder, UserProfile, AppConfiguration, Task } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { AI_PROJECT_SCHEDULER_COST } from '@/lib/constants';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
import { addDays, format } from 'date-fns';
import {
    GenerateScheduleInputSchema,
    GenerateScheduleOutputSchema,
    AIModelOutputSchemaForSchedule,
    type GenerateScheduleInput,
    type GenerateScheduleOutput,
} from '@/types/server-only';


const generateScheduleFlow = ai.defineFlow(
    {
        name: 'generateScheduleFlow',
        inputSchema: GenerateScheduleInputSchema,
        outputSchema: GenerateScheduleOutputSchema,
    },
    async (input) => {
        const adminDb = getDb();
        const { userId, workOrderId, actorUid, actorName } = input;
        
        let actualCost = AI_PROJECT_SCHEDULER_COST;
        try {
            const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
            if(configDoc.exists) {
                const costConfig = (configDoc.data() as AppConfiguration).actionCosts?.find(c => c.key === 'AI_PROJECT_SCHEDULER_COST');
                if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
            }
        } catch(e) { console.warn("Could not fetch cost config for AI Project Scheduler."); }

        const userProfileRef = adminDb.collection('users').doc(userId);
        const userProfileSnap = await userProfileRef.get();
        if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
        const userProfileData = userProfileSnap.data() as UserProfile;
        if ((userProfileData.resourcePoints ?? 0) < actualCost) {
            throw new Error(`Insufficient resource points. You need ${actualCost}.`);
        }
        
        const woDocRef = adminDb.collection('workOrders').doc(workOrderId);
        const woSnap = await woDocRef.get();
        if (!woSnap.exists) throw new Error("Work Order not found.");
        const workOrder = woSnap.data() as WorkOrder;

        const promptText = `You are a construction project manager. Based on the following work order scope, create a high-level project schedule. Break down the scope into a logical sequence of tasks and estimate the duration in days for each task.

        **Work Order Scope of Work:**
        ${workOrder.scopeOfWork}

        **Line Items:**
        ${workOrder.items.map(item => `- ${item.description} (Qty: ${item.quantity} ${item.unit})`).join('\n')}

        Generate a list of tasks. For each task, provide a name and its duration in days. The tasks should be in a logical order of execution.
        `;

        let response;
        for (const modelName of MODEL_FALLBACK_LIST) {
            try {
                console.log(`Attempting schedule generation with model: ${modelName}`);
                const { output } = await ai.generate({
                    prompt: promptText,
                    model: modelName as any,
                    output: { schema: AIModelOutputSchemaForSchedule },
                });
                if (output) { response = output; break; }
            } catch (e: any) {
                console.warn(`Model ${modelName} failed for schedule generation. Error: ${e.message}`);
            }
        }
        
        if (!response || !response.tasks || response.tasks.length === 0) {
          throw new Error("AI failed to generate a valid schedule after trying all fallbacks.");
        }

        const batch = adminDb.batch();
        let currentDate = new Date(workOrder.startDate);
        
        for (const aiTask of response.tasks) {
            const startDate = new Date(currentDate);
            const endDate = addDays(startDate, Math.max(0, aiTask.durationInDays - 1));

            const newTask: Omit<Task, 'id'> = {
                userId: userId,
                workOrderId: workOrderId,
                name: aiTask.taskName,
                startDate: format(startDate, 'yyyy-MM-dd'),
                endDate: format(endDate, 'yyyy-MM-dd'),
                progress: 0,
                dependencies: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            
            const taskRef = adminDb.collection('tasks').doc();
            batch.set(taskRef, newTask);

            currentDate = addDays(endDate, 1);
        }
        
        const newResourcePoints = (userProfileData.resourcePoints ?? 0) - actualCost;
        batch.update(userProfileRef, { resourcePoints: newResourcePoints });

        await batch.commit();

        await logActivity({
            ownerId: userId,
            actorUid: actorUid || userId,
            actorName: actorName || "User",
            actionType: 'create',
            entityType: 'Task',
            entityName: `AI Schedule for WO #${workOrder.workOrderNumber}`,
            details: { message: `${response.tasks.length} tasks generated by AI.`, cost: actualCost }
        });
        
        return { tasksCreated: response.tasks.length, newResourcePoints };
    }
);

export async function generateSchedule(input: GenerateScheduleInput): Promise<GenerateScheduleOutput> {
  return await generateScheduleFlow(input);
}
