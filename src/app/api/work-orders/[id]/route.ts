import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { WorkOrder, WorkOrderItem, UserProfile, Company, Organization, TeamMember, AppConfiguration } from '@/types/server-only';
import { WORK_ORDER_CREATION_COST } from '@/lib/constants';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { format } from 'date-fns';
export const dynamic = 'force-dynamic';
const workOrderItemSchema = z.object({ id: z.string().optional(), itemCode: z.string().optional().nullable(), description: z.string().min(1), quantity: z.coerce.number().min(0.01), unit: z.string().min(1), rate: z.coerce.number().min(0), amount: z.number() });
const MAX_PROOF_SIZE = 1048576; 

const workOrderUpdateSchema = z.object({
  workOrderNumber: z.string().min(1, "Work Order number is required.").optional(),
  companyId: z.string().min(1, "Company ID is required.").optional(),
  organizationId: z.string().min(1, "Organization ID is required.").optional(),
  startDate: z.string().refine(val => !isNaN(Date.parse(val))).optional(),
  endDate: z.string().refine(val => !isNaN(Date.parse(val))).optional(),
  securityDeposit: z.coerce.number().optional().nullable(),
  depositPeriod: z.coerce.number().int().optional().nullable(),
  scopeOfWork: z.string().max(5000).optional().nullable(),
  status: z.enum(['draft', 'pending', 'approved', 'in-progress', 'completed', 'on-hold', 'cancelled']).optional(),
  items: z.array(workOrderItemSchema).min(1, "At least one item is required.").optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  estimateId: z.string().optional().nullable(),
  awardProofUrl: z.string().max(MAX_PROOF_SIZE, "Award proof file is too large.").optional().nullable(),
}).refine(data => !data.endDate || !data.startDate || new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});


async function authorizeAndGetWorkOrder(
  workOrderId: string, 
  authenticatedUserUid: string,
  requiredPermissionKey: keyof TeamMember['permissions'] | null
): Promise<{ authorized: boolean; workOrder?: WorkOrder; dataOwnerId?: string; error?: string; status?: number }> {
  const woDocRef = adminDb.collection('workOrders').doc(workOrderId);
  const woSnap = await woDocRef.get();

  if (!woSnap.exists) {
    return { authorized: false, error: 'Work Order not found.', status: 404 };
  }
  const workOrderData = { id: woSnap.id, ...woSnap.data() } as WorkOrder;
  const itemOwnerId = workOrderData.userId;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) {
    return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
  }
  const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  
  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, workOrder: workOrderData, dataOwnerId: itemOwnerId };
  }

  if (authUserProfile.ownerId === itemOwnerId) {
    if (!requiredPermissionKey) {
        return { authorized: true, workOrder: workOrderData, dataOwnerId: itemOwnerId };
    }
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.[requiredPermissionKey]) {
        return { authorized: true, workOrder: workOrderData, dataOwnerId: itemOwnerId };
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
    
    const authResult = await authorizeAndGetWorkOrder(id, decodedToken.uid, 'canViewWorkOrders');
    if (!authResult.authorized || !authResult.workOrder) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.workOrder, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/work-orders/[${id}] GET error:`, error);
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
    
    const authUserProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    const authResult = await authorizeAndGetWorkOrder(id, decodedToken.uid, 'canEditWorkOrders');
    if (!authResult.authorized || !authResult.workOrder || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const requestBody = await request.json();
    const validationResult = workOrderUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const dataToUpdate: { [key: string]: any } = {};

    Object.keys(dataFromClient).forEach(key => {
        if (dataFromClient[key as keyof typeof dataFromClient] !== undefined) {
            dataToUpdate[key] = dataFromClient[key as keyof typeof dataFromClient];
        }
    });

    if (dataToUpdate.companyId && dataToUpdate.companyId !== authResult.workOrder.companyId) {
      const companyDoc = await adminDb.collection('companies').doc(dataToUpdate.companyId).get();
      if (!companyDoc.exists || companyDoc.data()?.userId !== authResult.dataOwnerId) return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 });
      dataToUpdate.companyName = (companyDoc.data() as Company).name;
      dataToUpdate.companyAddress = (companyDoc.data() as Company).address;
    }
    if (dataToUpdate.organizationId && dataToUpdate.organizationId !== authResult.workOrder.organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(dataToUpdate.organizationId).get();
      if (!orgDoc.exists || (orgDoc.data()?.visibility !== 'public' && orgDoc.data()?.userId !== authResult.dataOwnerId)) return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
      dataToUpdate.organizationName = (orgDoc.data() as Organization).name;
      dataToUpdate.organizationAddress = (orgDoc.data() as Organization).address;
    }

    if (dataFromClient.items || dataFromClient.taxRate !== undefined) {
      const items = dataToUpdate.items || authResult.workOrder.items;
      dataToUpdate.items = items.map((item: any) => ({ ...item, amount: item.quantity * item.rate }));
      const subTotal = dataToUpdate.items.reduce((sum: number, item: any) => sum + item.amount, 0);
      const taxRate = dataToUpdate.taxRate ?? authResult.workOrder.taxRate ?? 0;
      const taxAmount = (subTotal * taxRate) / 100;
      dataToUpdate.subTotal = subTotal;
      dataToUpdate.taxableValue = subTotal; 
      dataToUpdate.taxAmount = taxAmount;
      dataToUpdate.grandTotal = subTotal + taxAmount;
    }

    dataToUpdate.updatedAt = new Date().toISOString();
    dataToUpdate.updatedBy = decodedToken.uid;
    dataToUpdate.updatedByName = authUserProfile.fullName || authUserProfile.email || "User";
    
    await adminDb.collection('workOrders').doc(id).update(dataToUpdate);

    let logDetailsMessage = `Work Order ${dataToUpdate.workOrderNumber || authResult.workOrder.workOrderNumber} updated.`;
    if (dataToUpdate.status && dataToUpdate.status !== authResult.workOrder.status) {
        logDetailsMessage = `Work Order status changed from '${authResult.workOrder.status}' to '${dataToUpdate.status}'.`;
    }
    
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'update', entityType: 'WorkOrder', entityId: id, entityName: dataToUpdate.workOrderNumber || authResult.workOrder.workOrderNumber,
        details: logDetailsMessage
    });

    const updatedDoc = await adminDb.collection('workOrders').doc(id).get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/work-orders/[${id}] PUT error:`, error);
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
    
    const authResult = await authorizeAndGetWorkOrder(id, decodedToken.uid, 'canDeleteWorkOrders');
    if (!authResult.authorized || !authResult.workOrder || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const authUserProfile = await (await adminDb.collection('users').doc(decodedToken.uid).get()).data() as UserProfile;

    if (['in-progress', 'completed', 'on-hold', 'approved'].includes(authResult.workOrder.status)) {
        return NextResponse.json({ error: 'Cannot delete an active or completed Work Order. Please cancel it first.', code: 'WO_DELETE_RESTRICTED' }, { status: 409 });
    }

    await adminDb.collection('workOrders').doc(id).delete();
    
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'delete', entityType: 'WorkOrder', entityId: id, entityName: authResult.workOrder.workOrderNumber,
        details: `Work Order ${authResult.workOrder.workOrderNumber} deleted.`
    });
    return NextResponse.json({ message: 'Work Order deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/work-orders/[${id}] DELETE error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
