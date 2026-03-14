
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { InventoryItem, Company, WorkOrder, UserProfile, TeamMember, AppConfiguration, InventoryTransaction } from '@/types/server-only';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { INVENTORY_ITEM_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const inventoryItemCreateSchema = z.object({
  name: z.string().min(1, "Item name is required.").max(255),
  description: z.string().max(1000).optional().or(z.literal('')).nullable(),
  sku: z.string().max(100).optional().or(z.literal('')).nullable(),
  unitOfMeasure: z.string().min(1, "Unit of measure is required.").max(50),
  purchasePrice: z.coerce.number().min(0, "Purchase price must be non-negative.").optional().nullable(),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative."),
  quantityOnHand: z.coerce.number().int("Quantity must be a whole number.").min(0).optional().nullable(),
  lowStockThreshold: z.coerce.number().int("Threshold must be a whole number.").min(0).optional().nullable(),
  category: z.string().max(100).optional().or(z.literal('')).nullable(),
  dataOwnerId: z.string().min(1, "Data owner context is required."),
});

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    if (!requestedDataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true;
    } else {
      const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if (memberProfileDoc.exists) {
        const memberProfile = memberProfileDoc.data() as UserProfile;
        if (memberProfile.ownerId === requestedDataOwnerId) {
          const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
          const teamMemberDocSnap = await teamMemberDocRef.get();
          if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageInventory) canAccess = true;
          }
        }
      }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    const itemsSnapshot = await adminDb.collection('inventoryItems')
      .where('userId', '==', requestedDataOwnerId)
      .orderBy('name', 'asc')
      .get();
    const items: InventoryItem[] = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
    return NextResponse.json(items, { status: 200 });

  } catch (error: any) {
    console.error('API /api/inventory GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const functionCallId = `api_inventory_POST_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = inventoryItemCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...dataFromClient } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;
    
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) {
        canCreate = true;
    } else {
        if (actorProfile.ownerId === dataOwnerId) {
            const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if (teamMemberDocSnap.exists) {
                const teamMemberData = teamMemberDocSnap.data() as TeamMember;
                if (teamMemberData.permissions?.canManageInventory) {
                    canCreate = true;
                }
            }
        }
    }
    
    if (!canCreate) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to create inventory items for this account.' }, { status: 403 });
    }

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_INVENTORY_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = INVENTORY_ITEM_CREATION_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "INVENTORY_ITEM_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /inventory POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    const now = new Date().toISOString();
    const newItemData: Omit<InventoryItem, 'id'> = {
      userId: dataOwnerId,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      name: dataFromClient.name,
      description: dataFromClient.description || null,
      sku: dataFromClient.sku || null,
      unitOfMeasure: dataFromClient.unitOfMeasure,
      purchasePrice: dataFromClient.purchasePrice ?? null,
      sellingPrice: dataFromClient.sellingPrice,
      quantityOnHand: dataFromClient.quantityOnHand ?? 0, // Default to 0 if not provided
      lowStockThreshold: dataFromClient.lowStockThreshold ?? null,
      category: dataFromClient.category || null,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };
    
    const batch = adminDb.batch();
    const newInventoryItemRef = adminDb.collection('inventoryItems').doc();
    batch.set(newInventoryItemRef, newItemData);
    
    // If an initial quantity is provided, log it as the first transaction
    if (newItemData.quantityOnHand && newItemData.quantityOnHand > 0) {
      const transactionLogRef = adminDb.collection('inventoryTransactions').doc();
      const initialTransaction: Omit<InventoryTransaction, 'id'> = {
        userId: dataOwnerId,
        inventoryItemId: newInventoryItemRef.id,
        inventoryItemName: newItemData.name,
        type: 'receive',
        quantityChange: newItemData.quantityOnHand,
        quantityBefore: 0,
        quantityAfter: newItemData.quantityOnHand,
        transactionDate: now,
        remarks: "Initial stock quantity.",
        createdByName: "System",
        actorUid: authenticatedUserUid,
        documentUrl: null,
        linkedExpenseId: null,
      };
      batch.set(transactionLogRef, initialTransaction);
    }

    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });
    
    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create', entityType: 'InventoryItem', entityId: newInventoryItemRef.id, entityName: newItemData.name,
      details: { message: `Inventory item '${newItemData.name}' created.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newInventoryItemRef.id, ...newItemData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/inventory POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
