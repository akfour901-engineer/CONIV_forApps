


import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { PurchaseOrder, PurchaseOrderItem, UserProfile, Company, Organization, TeamMember, WorkOrder } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const purchaseOrderItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1),
  type: z.enum(['material', 'service']),
  quantity: z.coerce.number().min(0.01),
  unit: z.string().min(1),
  rate: z.coerce.number().min(0),
});

const purchaseOrderUpdateSchema = z.object({
  poNumber: z.string().min(1).max(100).optional(),
  date: z.string().refine(val => !isNaN(Date.parse(val))).optional(),
  companyId: z.string().min(1).optional(),
  supplierOrganizationId: z.string().min(1).optional(),
  workOrderId: z.string().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  shippingAddress: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  paymentTerms: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'billed', 'cancelled']).optional(),
  linkedExpenseId: z.string().optional().nullable(),
}).partial();

async function authorizeAndGetPurchaseOrder(
  poId: string,
  authenticatedUserUid: string,
  requiredPermissionKey: keyof TeamMember['permissions']
): Promise<{ authorized: boolean; poData?: PurchaseOrder; dataOwnerId?: string; error?: string; status?: number }> {
    const poDocRef = adminDb.collection('purchaseOrders').doc(poId);
    const poSnap = await poDocRef.get();

    if (!poSnap.exists) {
        return { authorized: false, error: 'Purchase Order not found.', status: 404 };
    }
    const poData = { id: poSnap.id, ...poSnap.data() } as PurchaseOrder;
    const itemOwnerId = poData.userId;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;

    if (authUserProfile.uid === itemOwnerId) {
        return { authorized: true, poData, dataOwnerId: itemOwnerId };
    }

    if (authUserProfile.ownerId === itemOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.[requiredPermissionKey]) {
                return { authorized: true, poData, dataOwnerId: itemOwnerId };
            }
        }
    }
    return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAndGetPurchaseOrder(id, decodedToken.uid, 'canViewPurchaseOrders');
    if (!authResult.authorized || !authResult.poData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.poData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/purchase-orders/[${id}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    try {
      const authorizationHeader = request.headers.get('Authorization');
      if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const idToken = authorizationHeader.split('Bearer ')[1];
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const authenticatedUserUid = decodedToken.uid;
  
      const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
      const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  
      const authResult = await authorizeAndGetPurchaseOrder(id, authenticatedUserUid, 'canEditPurchaseOrders');
      if (!authResult.authorized || !authResult.poData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
      
      const requestBody = await request.json();
      const validationResult = purchaseOrderUpdateSchema.safeParse(requestBody);
      if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
      
      const dataFromClient = validationResult.data;
      
      const dataToUpdate: { [key: string]: any } = {};
  
      Object.keys(dataFromClient).forEach(key => {
          const typedKey = key as keyof typeof dataFromClient;
          if (dataFromClient[typedKey] !== undefined) {
              dataToUpdate[typedKey] = dataFromClient[typedKey];
          }
      });
  
      if (dataFromClient.companyId && dataFromClient.companyId !== authResult.poData.companyId) {
        const companyDoc = await adminDb.collection('companies').doc(dataFromClient.companyId).get();
        if (!companyDoc.exists || companyDoc.data()?.userId !== authResult.dataOwnerId) return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 });
        dataToUpdate.companyName = (companyDoc.data() as Company).name;
      }
      
      if (dataFromClient.supplierOrganizationId && dataFromClient.supplierOrganizationId !== authResult.poData.supplierOrganizationId) {
        const orgDoc = await adminDb.collection('organizations').doc(dataFromClient.supplierOrganizationId).get();
        if (!orgDoc.exists || (orgDoc.data()?.visibility !== 'public' && orgDoc.data()?.userId !== authResult.dataOwnerId)) return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
        dataToUpdate.supplierOrganizationName = (orgDoc.data() as Organization).name;
      }

      if (dataFromClient.workOrderId !== undefined) {
          if (dataFromClient.workOrderId) {
              const woDoc = await adminDb.collection('workOrders').doc(dataFromClient.workOrderId).get();
              if(woDoc.exists && woDoc.data()?.userId === authResult.dataOwnerId) {
                  dataToUpdate.workOrderNumber = (woDoc.data() as WorkOrder).workOrderNumber;
              } else {
                  dataToUpdate.workOrderId = null;
                  dataToUpdate.workOrderNumber = null;
              }
          } else {
              dataToUpdate.workOrderNumber = null;
          }
      }
  
      if (dataFromClient.items || dataFromClient.taxRate !== undefined) {
        const items = dataToUpdate.items || authResult.poData.items;
        dataToUpdate.items = items.map((item: any) => ({ ...item, amount: item.quantity * item.rate }));
        const subTotal = dataToUpdate.items.reduce((sum: number, item: any) => sum + item.amount, 0);
        const taxRate = dataToUpdate.taxRate ?? authResult.poData.taxRate ?? 0;
        const taxAmount = (subTotal * taxRate) / 100;
        dataToUpdate.subTotal = subTotal;
        dataToUpdate.taxAmount = taxAmount;
        dataToUpdate.grandTotal = subTotal + taxAmount;
      }
  
      dataToUpdate.updatedAt = new Date().toISOString();
      dataToUpdate.updatedBy = authenticatedUserUid;
      dataToUpdate.updatedByName = authUserProfile.fullName || authUserProfile.email || "User";
      
      await adminDb.collection('purchaseOrders').doc(id).update(dataToUpdate);
  
      let logDetailsMessage = `PO ${dataToUpdate.poNumber || authResult.poData.poNumber} updated.`;
      if (dataToUpdate.status && dataToUpdate.status !== authResult.poData.status) {
          logDetailsMessage = `PO status changed from '${authResult.poData.status}' to '${dataToUpdate.status}'.`;
      }
      
      await logActivity({
          ownerId: authResult.dataOwnerId, actorUid: authenticatedUserUid, actorName: authUserProfile.fullName || authUserProfile.email || "User",
          actionType: 'update', entityType: 'PurchaseOrder', entityId: id, entityName: dataToUpdate.poNumber || authResult.poData.poNumber,
          details: logDetailsMessage
      });
  
      const updatedDoc = await adminDb.collection('purchaseOrders').doc(id).get();
      return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });
  
    } catch (error: any) {
      console.error(`API /api/purchase-orders/[${id}] PUT error:`, error);
      return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
    }
}
  

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAndGetPurchaseOrder(id, decodedToken.uid, 'canDeletePurchaseOrders');
    if (!authResult.authorized || !authResult.poData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const authUserProfile = await (await adminDb.collection('users').doc(decodedToken.uid).get()).data() as UserProfile;

    if (['ordered', 'partially_received', 'received', 'billed'].includes(authResult.poData.status)) {
        return NextResponse.json({ error: 'Cannot delete an active or processed PO. Please cancel it first.', code: 'PO_DELETE_RESTRICTED' }, { status: 409 });
    }

    await adminDb.collection('purchaseOrders').doc(id).delete();
    
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'delete', entityType: 'PurchaseOrder', entityId: id, entityName: authResult.poData.poNumber,
        details: `PO ${authResult.poData.poNumber} deleted.`
    });
    return NextResponse.json({ message: 'Purchase Order deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/purchase-orders/[${id}] DELETE error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
