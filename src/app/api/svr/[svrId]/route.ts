



import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { ServiceVisitReport, UserProfile, TeamMember, WorkOrder } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { format, parseISO } from 'date-fns';
export const dynamic = 'force-dynamic';
const svrConsumedItemSchema = z.object({
  sourceType: z.enum(['work_order', 'inventory', 'purchase_order']),
  sourceId: z.string(),
  sourceName: z.string(),
  workOrderItemId: z.string().optional(),
  description: z.string(),
  unit: z.string(),
  consumedQuantity: z.coerce.number().min(0),
  rate: z.coerce.number(),
  amount: z.coerce.number(),
});

const svrUpdateSchema = z.object({
  workOrderId: z.string().min(1, "Work Order is required.").optional(),
  visitDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid visit date." }).optional(),
  purposeOfVisit: z.string().min(1, "This field is required.").max(500).optional(),
  actionsTaken: z.string().min(1, "This field is required.").max(2000).optional(),
  nextSteps: z.string().max(1000).optional().nullable(),
  clientFeedback: z.string().max(1000).optional().nullable(),
  visitRating: z.coerce.number().min(1).max(10).optional(),
  consumedItems: z.array(svrConsumedItemSchema).optional().nullable(),
}).partial();

async function authorizeAccess(
  svrId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; svrData?: ServiceVisitReport; dataOwnerId?: string; error?: string; status?: number }> {
  
  const svrDocRef = adminDb.collection('serviceVisitReports').doc(svrId);
  const svrSnap = await svrDocRef.get();
  if (!svrSnap.exists) return { authorized: false, error: 'SVR not found', status: 404 };
  
  const svrData = { id: svrSnap.id, ...svrSnap.data() } as ServiceVisitReport;
  const itemOwnerId = svrData.userId;
  
  const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!actorProfileDoc.exists) return { authorized: false, error: 'User profile not found', status: 403 };
  
  const actorProfile = actorProfileDoc.data() as UserProfile;
  
  // Case 1: The user is the direct owner of the item.
  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, svrData, dataOwnerId: itemOwnerId };
  }

  // Case 2: The user is a team member, check if their owner matches the item owner.
  if (actorProfile.ownerId === itemOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        // Grant access if they have permission to manage SVRs
        if (teamMemberData.permissions?.canManageSvr) {
            return { authorized: true, svrData, dataOwnerId: itemOwnerId };
        }
    }
  }

  return { authorized: false, error: 'Forbidden: You do not have permission.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { svrId: string } }) {
  const { svrId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAccess(svrId, decodedToken.uid);
    if (!authResult.authorized || !authResult.svrData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.svrData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/svr/[${svrId}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { svrId: string } }) {
  const { svrId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAccess(svrId, decodedToken.uid);
    if (!authResult.authorized || !authResult.svrData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const requestBody = await request.json();
    const validationResult = svrUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;
    
    const dataToUpdate: Partial<ServiceVisitReport> & { workOrderNumber?: string } = { ...dataFromClient };

    if (dataFromClient.workOrderId && dataFromClient.workOrderId !== authResult.svrData.workOrderId) {
      const workOrderDocRef = adminDb.collection('workOrders').doc(dataFromClient.workOrderId);
      const workOrderSnap = await workOrderDocRef.get();
      if (!workOrderSnap.exists || workOrderSnap.data()?.userId !== authResult.dataOwnerId) {
        return NextResponse.json({ error: 'New Work Order not found or access denied.' }, { status: 404 });
      }
      dataToUpdate.workOrderNumber = (workOrderSnap.data() as WorkOrder).workOrderNumber;
    }
    
    const now = new Date().toISOString();
    dataToUpdate.updatedAt = now;
    dataToUpdate.updatedBy = decodedToken.uid;
    dataToUpdate.updatedByName = userProfile.fullName || userProfile.email || "User";

    await adminDb.collection('serviceVisitReports').doc(svrId).update(dataToUpdate as any);

    await logActivity({
      ownerId: authResult.dataOwnerId,
      actorUid: decodedToken.uid,
      actorName: userProfile.fullName || userProfile.email || 'User',
      actionType: 'update',
      entityType: 'ServiceVisitReport',
      entityId: svrId,
      entityName: `SVR for WO#${dataToUpdate.workOrderNumber || authResult.svrData.workOrderNumber}`,
      details: `SVR for date ${dataFromClient.visitDate ? format(new Date(dataFromClient.visitDate), 'dd MMM yyyy') : formatDate(authResult.svrData.visitDate)} updated.`,
    });
    
    const updatedDoc = await adminDb.collection('serviceVisitReports').doc(svrId).get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/svr/[${svrId}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { svrId: string } }) {
  const { svrId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAccess(svrId, decodedToken.uid);
    if (!authResult.authorized || !authResult.svrData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;

    await adminDb.collection('serviceVisitReports').doc(svrId).delete();
    
    await logActivity({
      ownerId: authResult.dataOwnerId,
      actorUid: decodedToken.uid,
      actorName: userProfile.fullName || userProfile.email || 'User',
      actionType: 'delete',
      entityType: 'ServiceVisitReport',
      entityId: svrId,
      entityName: `SVR for WO#${authResult.svrData.workOrderNumber}`,
      details: `SVR for date ${formatDate(authResult.svrData.visitDate)} deleted.`,
    });

    return NextResponse.json({ message: 'Service Visit Report deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/svr/[${svrId}] DELETE error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

function formatDate(dateString: string | undefined | null) {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy'); }
  catch (e) { return dateString; }
}

    
