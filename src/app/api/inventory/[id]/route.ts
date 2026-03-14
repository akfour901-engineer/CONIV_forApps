



import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { InventoryItem, UserProfile, TeamMember } from '@/types/server-only';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const inventoryItemUpdateSchema = z.object({
  name: z.string().min(1, "Item name is required.").max(255).optional(),
  description: z.string().max(1000).optional().or(z.literal('')).nullable(),
  sku: z.string().max(100).optional().or(z.literal('')).nullable(),
  unitOfMeasure: z.string().min(1, "Unit of measure is required.").max(50).optional(),
  purchasePrice: z.coerce.number().min(0, "Purchase price must be non-negative.").optional().nullable(),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative.").optional(),
  quantityOnHand: z.coerce.number().int("Quantity must be a whole number.").min(0).optional().nullable(),
  lowStockThreshold: z.coerce.number().int("Threshold must be a whole number.").min(0).optional().nullable(),
  category: z.string().max(100).optional().or(z.literal('')).nullable(),
}).partial();

async function authorizeAccess(
  itemId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; itemData?: InventoryItem; dataOwnerId?: string; error?: string; status?: number }> {
  const itemDocRef = adminDb.collection('inventoryItems').doc(itemId);
  const itemSnap = await itemDocRef.get();
  if (!itemSnap.exists) return { authorized: false, error: 'Inventory Item not found', status: 404 };
  
  const itemData = { id: itemSnap.id, ...itemSnap.data() } as InventoryItem;
  const itemOwnerId = itemData.userId;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
  const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  
  // User is the direct owner of the item
  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, itemData, dataOwnerId: itemOwnerId };
  }

  // A team member can access their owner's items if they have permission.
  if (authUserProfile.ownerId === itemOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.canManageInventory) {
        return { authorized: true, itemData, dataOwnerId: itemOwnerId };
      }
    }
  }
  
  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const itemId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authResult = await authorizeAccess(itemId, decodedToken.uid);
    if (!authResult.authorized || !authResult.itemData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.itemData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/inventory/[${itemId}] GET error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const itemId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authResult = await authorizeAccess(itemId, decodedToken.uid);
    if (!authResult.authorized || !authResult.itemData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const requestBody = await request.json();
    const validationResult = inventoryItemUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;

    const dataToUpdate: Partial<InventoryItem> = {
      ...dataFromClient,
      updatedAt: new Date().toISOString(),
      updatedBy: decodedToken.uid,
      updatedByName: userProfile.fullName || userProfile.email || "User",
    };

    const cleanedData: { [key: string]: any } = {};
    for (const key in dataToUpdate) {
        if (dataToUpdate[key as keyof typeof dataToUpdate] !== undefined) {
           if (dataToUpdate[key as keyof typeof dataToUpdate] === "") {
               cleanedData[key] = null;
           } else {
               cleanedData[key] = dataToUpdate[key as keyof typeof dataToUpdate];
           }
        }
    }
    
    const itemDocRef = adminDb.collection('inventoryItems').doc(itemId);
    await itemDocRef.update(cleanedData);

    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'update', entityType: 'InventoryItem', entityId: itemId, entityName: dataToUpdate.name || authResult.itemData.name,
        details: `Inventory item '${dataToUpdate.name || authResult.itemData.name}' updated.`
    });

    const updatedDoc = await itemDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/inventory/[${itemId}] PUT error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const itemId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;

    const authResult = await authorizeAccess(itemId, decodedToken.uid);
    if (!authResult.authorized || !authResult.itemData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });

    await adminDb.collection('inventoryItems').doc(itemId).delete();
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'delete', entityType: 'InventoryItem', entityId: itemId, entityName: authResult.itemData.name,
        details: `Inventory item '${authResult.itemData.name}' deleted.`
    });
    return NextResponse.json({ message: 'Inventory item deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/inventory/[${itemId}] DELETE error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
