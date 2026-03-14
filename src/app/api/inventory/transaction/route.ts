



import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { InventoryItem, InventoryTransaction, UserProfile, TeamMember, AppConfiguration, WorkOrder, Expense, PurchaseOrder } from '@/types/server-only';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { INVENTORY_TRANSACTION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const transactionSchema = z.object({
  inventoryItemId: z.string().min(1),
  type: z.enum(['issue', 'receive']),
  quantityChange: z.coerce.number().positive("Quantity must be a positive number."),
  workOrderId: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  unitPrice: z.coerce.number().min(0).optional().nullable(), // Kept for expense logging on direct receive
  remarks: z.string().max(500).optional().nullable(),
  documentUrl: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1, "dataOwnerId is required"), // Explicitly require data context
});

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const actorUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = transactionSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    const { inventoryItemId, type, quantityChange, workOrderId, purchaseOrderId, unitPrice, remarks, documentUrl, dataOwnerId } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(actorUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'Actor profile not found.' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;
    
    // Authorization Check
    let canManageInventory = false;
    // Owner acting on their own account
    if (actorUid === dataOwnerId) {
        canManageInventory = true;
    } 
    // Team member acting on owner's account
    else if (actorProfile.ownerId === dataOwnerId) { 
        const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(actorUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            canManageInventory = (teamMemberDocSnap.data() as TeamMember).permissions?.canManageInventory || false;
        }
    }

    if (!canManageInventory) return NextResponse.json({ error: 'Forbidden: You do not have permission to manage inventory.' }, { status: 403 });

    // --- Start Transaction ---
    const result = await adminDb.runTransaction(async (transaction) => {
        const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
        const pointPayerProfileSnap = await transaction.get(pointPayerProfileRef);
        if (!pointPayerProfileSnap.exists) throw new Error('Data owner profile not found for point deduction.');
        
        const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
        let actualCost = INVENTORY_TRANSACTION_COST;
        
        try {
            const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
            const appConfigSnap = await transaction.get(appConfigDocRef);
            if (appConfigSnap.exists) {
                const configData = appConfigSnap.data() as AppConfiguration;
                const costConfig = configData.actionCosts?.find(c => c.key === "INVENTORY_TRANSACTION_COST");
                if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
            }
        } catch (configError) { console.warn("Could not fetch app config for inventory transaction cost."); }

        if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
            throw new Error(`Insufficient resource points. Owner needs ${actualCost}.`);
        }

        const itemRef = adminDb.collection('inventoryItems').doc(inventoryItemId);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists) throw new Error('Inventory item not found.');
        
        const itemData = itemSnap.data() as InventoryItem;
        console.log(`[INVENTORY_TX_API] Inside Transaction - Item's userId: ${itemData.userId}, Data Owner ID for check: ${dataOwnerId}`);
        if (itemData.userId !== dataOwnerId) {
          throw new Error('Access denied. This inventory item does not belong to the correct data scope.');
        }
        
        const quantityBefore = itemData.quantityOnHand ?? 0;
        let quantityAfter;

        if (type === 'issue') {
            if (quantityBefore < quantityChange) throw new Error(`Cannot issue ${quantityChange} items. Only ${quantityBefore} available.`);
            quantityAfter = quantityBefore - quantityChange;
        } else { // receive
            quantityAfter = quantityBefore + quantityChange;
        }
        
        let workOrderDetails: { workOrderNumber: string | null, companyId: string | null, companyName: string | null } = { workOrderNumber: null, companyId: null, companyName: null };
        if (workOrderId) {
            const woRef = adminDb.collection('workOrders').doc(workOrderId);
            const woSnap = await transaction.get(woRef);
            if (woSnap.exists && woSnap.data()?.userId === dataOwnerId) {
                const woData = woSnap.data() as WorkOrder;
                workOrderDetails.workOrderNumber = woData.workOrderNumber;
                workOrderDetails.companyId = woData.companyId;
                workOrderDetails.companyName = woData.companyName;
            } else {
                 console.warn(`Work Order ${workOrderId} not found or not accessible during inventory transaction.`);
            }
        }
        
        const now = new Date().toISOString();
        const transactionLogRef = adminDb.collection('inventoryTransactions').doc();
        let linkedExpenseId: string | null = null;
        
        // Corrected cost calculation logic
        let effectiveUnitPrice = 0;
        if (type === 'issue') {
            effectiveUnitPrice = itemData.purchasePrice ?? itemData.sellingPrice ?? 0;
        } else { // receive
            effectiveUnitPrice = unitPrice ?? itemData.purchasePrice ?? 0;
        }
        const totalCostForTx = effectiveUnitPrice * quantityChange;


        // Expense logging logic
        if (type === 'issue' && workOrderId && totalCostForTx > 0) {
            const newExpenseRef = adminDb.collection('expenses').doc();
            linkedExpenseId = newExpenseRef.id;
            const expenseData: Omit<Expense, 'id'> = {
                userId: dataOwnerId,
                createdByName: `System (via Inventory Issue)`,
                date: now.split('T')[0],
                category: 'Materials from Stock',
                description: `Used: ${itemData.name} (Qty: ${quantityChange}) for WO #${workOrderDetails.workOrderNumber}`,
                amount: totalCostForTx,
                receiptUrl: documentUrl || null,
                companyId: workOrderDetails.companyId,
                companyName: workOrderDetails.companyName,
                workOrderId: workOrderId,
                workOrderNumber: workOrderDetails.workOrderNumber,
                createdAt: now,
                updatedAt: now,
                updatedBy: actorUid,
                updatedByName: actorProfile.fullName || actorProfile.email || "User",
            };
            transaction.set(newExpenseRef, expenseData);
        } else if (type === 'receive' && !purchaseOrderId && totalCostForTx > 0) {
            const newExpenseRef = adminDb.collection('expenses').doc();
            linkedExpenseId = newExpenseRef.id;
            const expenseData: Omit<Expense, 'id'> = {
                userId: dataOwnerId,
                createdByName: `System (via Inventory Receive)`,
                date: now.split('T')[0],
                category: 'Material Purchase (Direct)',
                description: `Received: ${itemData.name} (Qty: ${quantityChange})`,
                amount: totalCostForTx,
                receiptUrl: documentUrl || null,
                companyId: null, 
                companyName: null,
                workOrderId: null,
                workOrderNumber: null,
                createdAt: now,
                updatedAt: now,
                updatedBy: actorUid,
                updatedByName: actorProfile.fullName || actorProfile.email || "User",
            };
            transaction.set(newExpenseRef, expenseData);
        }

        const transactionLog: Omit<InventoryTransaction, 'id'> = {
            userId: dataOwnerId,
            inventoryItemId: inventoryItemId,
            inventoryItemName: itemData.name,
            type: type,
            quantityChange: quantityChange,
            quantityBefore: quantityBefore,
            quantityAfter: quantityAfter,
            transactionDate: now,
            workOrderId: workOrderId || null,
            workOrderNumber: workOrderDetails.workOrderNumber,
            purchaseOrderId: purchaseOrderId || null,
            remarks: remarks || null,
            createdByName: actorProfile.fullName || actorProfile.email || 'N/A',
            actorUid: actorUid,
            documentUrl: documentUrl || null,
            linkedExpenseId: linkedExpenseId,
        };

        transaction.set(transactionLogRef, transactionLog);
        transaction.update(itemRef, { quantityOnHand: quantityAfter, updatedAt: now, updatedBy: actorUid, updatedByName: actorProfile.fullName || actorProfile.email });
        transaction.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-actualCost) });
        
        return { success: true, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, linkedExpenseId };
    });
    // --- End Transaction ---

    await logActivity({
      ownerId: dataOwnerId,
      actorUid: actorUid,
      actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'update',
      entityType: 'InventoryItem',
      entityId: inventoryItemId,
      entityName: (await adminDb.collection('inventoryItems').doc(inventoryItemId).get()).data()?.name || 'Item',
      details: { 
          message: `Item ${type}d. Quantity change: ${type === 'issue' ? '-' : '+'}${quantityChange}.`, 
          cost: INVENTORY_TRANSACTION_COST,
          linkedExpense: result.linkedExpenseId || undefined
      }
    });

    return NextResponse.json(result, { status: 200 });
    
  } catch (error: any) {
    console.error("Error processing inventory transaction:", error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
