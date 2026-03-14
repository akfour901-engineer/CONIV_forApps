


import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { DailyProgressReport, UserProfile, TeamMember, WorkOrder } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { format, parseISO } from 'date-fns';
export const dynamic = 'force-dynamic';
const dprConsumedItemSchema = z.object({
  workOrderItemId: z.string().optional(),
  description: z.string(),
  unit: z.string(),
  consumedQuantity: z.coerce.number().min(0),
  rate: z.coerce.number(),
  amount: z.coerce.number(),
  sourceType: z.enum(['work_order', 'inventory', 'purchase_order']),
  sourceId: z.string(),
  sourceName: z.string(),
});

const dprUpdateSchema = z.object({
  workOrderId: z.string().min(1, "Work Order is required.").optional(),
  reportDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid report date." }).optional(),
  workUpToYesterday: z.string().min(1, "This field is required.").max(2000).optional(),
  todaysPlanning: z.string().min(1, "This field is required.").max(2000).optional(),
  todaysWorkAllocation: z.string().min(1, "This field is required.").max(2000).optional(),
  todaysCompletion: z.string().min(1, "This field is required.").max(2000).optional(),
  workRating: z.coerce.number().min(1).max(10).optional(),
  sitePhotos: z.array(z.string()).max(5).optional().nullable(),
  consumedItems: z.array(dprConsumedItemSchema).optional().nullable(),
}).partial();


async function authorizeAndGetDpr(
  dprId: string, 
  authenticatedUserUid: string,
): Promise<{ authorized: boolean; dprData?: DailyProgressReport; dataOwnerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
  const dprDocRef = adminDb.collection('dailyProgressReports').doc(dprId);
  const dprSnap = await dprDocRef.get();
  if (!dprSnap.exists) return { authorized: false, error: 'DPR not found', status: 404 };
  
  const dprData = { id: dprSnap.id, ...dprSnap.data() } as DailyProgressReport;
  const itemOwnerId = dprData.userId;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
  const actorProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;

  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, dprData, dataOwnerId: itemOwnerId, actorProfile };
  }

  if (actorProfile.ownerId === itemOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.canManageDpr) {
        return { authorized: true, dprData, dataOwnerId: itemOwnerId, actorProfile };
      }
    }
  }
  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { dprId: string } }) {
  const { dprId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAndGetDpr(dprId, decodedToken.uid);
    if (!authResult.authorized || !authResult.dprData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.dprData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/dpr/[${dprId}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { dprId: string } }) {
  const { dprId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAndGetDpr(dprId, decodedToken.uid);
    if (!authResult.authorized || !authResult.dprData || !authResult.dataOwnerId || !authResult.actorProfile) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    const { actorProfile, dataOwnerId } = authResult;
    
    const requestBody = await request.json();
    const validationResult = dprUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const dataToUpdate: Partial<DailyProgressReport> & { workOrderNumber?: string; companyId?: string } = { ...dataFromClient };

    if (dataFromClient.workOrderId && dataFromClient.workOrderId !== authResult.dprData.workOrderId) {
      const workOrderDocRef = adminDb.collection('workOrders').doc(dataFromClient.workOrderId);
      const workOrderSnap = await workOrderDocRef.get();
      if (!workOrderSnap.exists || workOrderSnap.data()?.userId !== dataOwnerId) {
        return NextResponse.json({ error: 'New Work Order not found or access denied.' }, { status: 404 });
      }
      const workOrderData = workOrderSnap.data() as WorkOrder;
      dataToUpdate.workOrderNumber = workOrderData.workOrderNumber;
      dataToUpdate.companyId = workOrderData.companyId;
    }
    
    dataToUpdate.updatedAt = new Date().toISOString();

    await adminDb.collection('dailyProgressReports').doc(dprId).update(dataToUpdate as any);
    
    await logActivity({
      ownerId: dataOwnerId,
      actorUid: decodedToken.uid,
      actorName: actorProfile.fullName || actorProfile.email || 'User',
      actionType: 'update',
      entityType: 'DailyProgressReport',
      entityId: dprId,
      entityName: `DPR for WO#${dataToUpdate.workOrderNumber || authResult.dprData.workOrderNumber}`,
      details: `DPR for date ${dataFromClient.reportDate ? format(new Date(dataFromClient.reportDate), 'dd MMM yyyy') : format(new Date(authResult.dprData.reportDate), 'dd MMM yyyy')} updated.`,
    });
    
    const updatedDoc = await adminDb.collection('dailyProgressReports').doc(dprId).get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/dpr/[${dprId}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { dprId: string } }) {
    const { dprId } = params;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        
        const authResult = await authorizeAndGetDpr(dprId, decodedToken.uid);
        if (!authResult.authorized || !authResult.dprData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        
        await adminDb.collection('dailyProgressReports').doc(dprId).delete();
        
        await logActivity({
            ownerId: authResult.dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: authResult.actorProfile.fullName || 'User',
            actionType: 'delete',
            entityType: 'DailyProgressReport',
            entityId: dprId,
            entityName: `DPR for WO#${authResult.dprData.workOrderNumber}`,
        });

        return NextResponse.json({ message: 'DPR deleted successfully.' }, { status: 200 });
    } catch (error: any) {
        console.error(`API /api/dpr/[${dprId}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
    