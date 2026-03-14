
import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { WorkOrder, InventoryItem, PurchaseOrder, TeamMember, UserProfile } from '@/types/server-only';

export const dynamic = 'force-dynamic';

// Define the shape of the items to be returned
export interface ConsumableItem {
  sourceType: 'work_order' | 'inventory' | 'purchase_order';
  sourceId: string;
  sourceName: string; // e.g., "WO-001", "Main Inventory", "PO-123"
  workOrderItemId?: string; // Only for items from the WO itself
  description: string;
  unit: string;
  rate: number;
}


async function authorizeAccess(authenticatedUserUid: string, workOrderId: string): Promise<{ authorized: boolean; dataOwnerId?: string; error?: string; status?: number }> {
    const adminDb = getDb();
    const woDocRef = adminDb.collection('workOrders').doc(workOrderId);
    const woSnap = await woDocRef.get();
    if (!woSnap.exists) {
        return { authorized: false, error: 'Work Order not found', status: 404 };
    }
    
    const workOrderData = { id: woSnap.id, ...woSnap.data() } as WorkOrder;
    const itemOwnerId = workOrderData.userId;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;
    
    const dataOwnerIdForRequest = authUserProfile.ownerId || authenticatedUserUid;
    if (itemOwnerId !== dataOwnerIdForRequest) {
        return { authorized: false, error: 'Forbidden: This Work Order does not belong to your data scope.', status: 403 };
    }

    if (authenticatedUserUid === itemOwnerId) {
        return { authorized: true, dataOwnerId: itemOwnerId };
    }

    if (authUserProfile.ownerId && authUserProfile.ownerId === itemOwnerId) { 
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageDpr || teamMemberData.permissions?.canManageSvr) { // Check for DPR or SVR management permission
                return { authorized: true, dataOwnerId: itemOwnerId };
            }
        }
    }
    return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}


export async function GET(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        const url = new URL(request.url);
        const workOrderId = url.searchParams.get('workOrderId');

        if (!workOrderId) {
            return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
        }

        const authResult = await authorizeAccess(decodedToken.uid, workOrderId);
        if (!authResult.authorized || !authResult.dataOwnerId) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        
        const { dataOwnerId } = authResult;

        // 1. Fetch items from the Work Order itself
        const woDoc = await adminDb.collection('workOrders').doc(workOrderId).get();
        const workOrder = { id: woDoc.id, ...woDoc.data() } as WorkOrder;
        const woItems: ConsumableItem[] = (workOrder.items || []).map(item => ({
            sourceType: 'work_order' as const,
            sourceId: workOrder.id!,
            sourceName: `From WO: ${workOrder.workOrderNumber}`,
            workOrderItemId: item.id,
            description: item.description,
            unit: item.unit,
            rate: item.rate,
        }));

        // 2. Fetch items from the general Inventory
        const inventorySnap = await adminDb.collection('inventoryItems').where('userId', '==', dataOwnerId).get();
        const inventoryItems: ConsumableItem[] = inventorySnap.docs.map(doc => {
            const item = doc.data() as InventoryItem;
            return {
                sourceType: 'inventory' as const,
                sourceId: doc.id,
                sourceName: 'From Main Inventory',
                description: item.name,
                unit: item.unitOfMeasure,
                rate: item.sellingPrice,
            };
        });

        // 3. Fetch items from Purchase Orders linked to this Work Order
        const poSnap = await adminDb.collection('purchaseOrders').where('userId', '==', dataOwnerId).where('workOrderId', '==', workOrderId).get();
        const poItems: ConsumableItem[] = poSnap.docs.reduce<ConsumableItem[]>((acc, doc) => {
            const po = doc.data() as PurchaseOrder;
            if (po && Array.isArray(po.items)) {
                const itemsFromPo = po.items.map(item => ({
                    sourceType: 'purchase_order' as const,
                    sourceId: doc.id,
                    sourceName: `From PO: ${po.poNumber}`,
                    description: item.description,
                    unit: item.unit,
                    rate: item.rate,
                }));
                return acc.concat(itemsFromPo);
            }
            return acc;
        }, []);
        
        // Combine and de-duplicate
        const allItemsMap = new Map<string, ConsumableItem>();
        
        const addToMap = (item: ConsumableItem) => {
            const key = `${item.description.trim().toLowerCase()}|${item.unit.trim().toLowerCase()}`;
            if (!allItemsMap.has(key)) {
                allItemsMap.set(key, item);
            }
        };

        woItems.forEach(addToMap);
        inventoryItems.forEach(addToMap);
        poItems.forEach(addToMap);

        const combinedItems = Array.from(allItemsMap.values());
        
        return NextResponse.json(combinedItems, { status: 200 });

    } catch (error: any) {
        console.error("API /api/dpr/available-items GET error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
