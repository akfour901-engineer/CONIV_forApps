import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, WorkOrder, InventoryItem, AppConfiguration } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';

const MaterialsForecasterInputSchema = z.object({
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
export type MaterialsForecasterInput = z.infer<typeof MaterialsForecasterInputSchema>;

const AIModelOutputSchema = z.object({
  shortageSummary: z.string().describe("A high-level summary of the material situation, noting any critical shortages."),
  procurementList: z.array(z.object({
    itemName: z.string(),
    requiredStock: z.number(),
    currentStock: z.number(),
    shortfall: z.number(),
    estimatedCost: z.number(),
  })).describe("A detailed list of items that need to be procured."),
  riskAnalysis: z.string().describe("An analysis of risks associated with potential shortages, such as project delays."),
});


export const MaterialsForecasterOutputSchema = AIModelOutputSchema.extend({
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
export type MaterialsForecasterOutput = z.infer<typeof MaterialsForecasterOutputSchema>;

const materialsForecasterFlow = ai.defineFlow(
  {
    name: 'materialsForecasterFlow_api',
    inputSchema: MaterialsForecasterInputSchema,
    outputSchema: MaterialsForecasterOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    const { userId, actorUid, actorName } = input;
    
    let actualCost = 40; // Default cost
    try {
      const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if(configDoc.exists) {
          const config = configDoc.data() as AppConfiguration;
          const costConfig = config.actionCosts?.find(c => c.key === 'AI_MATERIALS_FORECASTER_COST');
          if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
      }
    } catch(e) { console.warn("Could not fetch cost config for Materials Forecaster."); }

    const userProfileRef = adminDb.collection('users').doc(userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
    const userProfileData = userProfileSnap.data() as UserProfile;
    if ((userProfileData.resourcePoints ?? 0) < actualCost) {
      throw new Error(`Insufficient resource points. You need ${actualCost}.`);
    }

    const [woSnap, inventorySnap] = await Promise.all([
      adminDb.collection('workOrders').where('userId', '==', userId).where('status', 'in', ['approved', 'in-progress']).get(),
      adminDb.collection('inventoryItems').where('userId', '==', userId).get(),
    ]);
    
    const workOrders = woSnap.docs.map(doc => doc.data() as WorkOrder);
    const inventory = inventorySnap.docs.map(doc => doc.data() as InventoryItem);

    const woSummary = workOrders.map(wo => 
        `WO#: ${wo.workOrderNumber}\nItems:\n${wo.items.map(item => `- ${item.description} (Qty: ${item.quantity})`).join('\n')}`
    ).join('\n\n');
    
    const inventorySummary = inventory.map(item => `- ${item.name} (SKU: ${item.sku || 'N/A'}, Qty: ${item.quantityOnHand}, Price: ${item.purchasePrice || item.sellingPrice})`).join('\n');

    const promptText = `You are a procurement manager for a construction company. Your task is to analyze upcoming work orders against current inventory to forecast material shortages.

    **Upcoming Work Orders:**
    ${woSummary || "No upcoming work orders."}

    **Current Inventory:**
    ${inventorySummary || "No items in inventory."}

    **Analysis Task:**
    1.  **shortageSummary:** Briefly summarize the material situation.
    2.  **procurementList:** Create a list of all materials that need to be purchased. For each, calculate the total required quantity from all work orders, compare it against the current stock, and list the shortfall. Estimate the procurement cost based on the provided price.
    3.  **riskAnalysis:** Identify any risks, such as potential project delays due to material shortages.
    `;
    
    const { output } = await ai.generate({
      prompt: promptText,
      model: 'googleai/gemini-pro',
      output: { schema: AIModelOutputSchema },
    });

    if (!output) throw new Error("AI model did not return a valid forecast.");

    const newResourcePoints = (userProfileData.resourcePoints ?? 0) - actualCost;
    await userProfileRef.update({ resourcePoints: newResourcePoints });
    
    await logActivity({
        ownerId: userId,
        actorUid: actorUid || userId,
        actorName: actorName || userProfileData.fullName || "User",
        actionType: 'audit_run',
        entityType: 'AI',
        entityName: `AI Materials Forecast`,
        details: { cost: actualCost }
    });
    
    return { ...output, newResourcePoints };
  }
);


export async function runMaterialsForecast(input: MaterialsForecasterInput): Promise<MaterialsForecasterOutput> {
    return await materialsForecasterFlow(input);
}
