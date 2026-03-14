


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { ServiceVisitReport, UserProfile, TeamMember, AppConfiguration, WorkOrder, Expense } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { SERVICE_VISIT_REPORT_CREATION_COST, EXPENSE_RECORDING_COST } from '@/lib/constants';
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

const svrCreateSchema = z.object({
  workOrderId: z.string().min(1, "Work Order is required."),
  visitDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid visit date." }),
  purposeOfVisit: z.string().min(1, "This field is required.").max(500),
  actionsTaken: z.string().min(1, "This field is required.").max(2000),
  nextSteps: z.string().max(1000).optional().nullable(),
  clientFeedback: z.string().max(1000).optional().nullable(),
  visitRating: z.coerce.number().min(1).max(10),
  consumedItems: z.array(svrConsumedItemSchema).optional().nullable(),
  dataOwnerId: z.string().min(1), // Explicitly pass context
});

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === requestedDataOwnerId) return true;
  const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (memberProfileDoc.exists) {
    const memberProfile = memberProfileDoc.data() as UserProfile;
    if (memberProfile.ownerId === requestedDataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        return (teamMemberDocSnap.data() as TeamMember).permissions?.canManageSvr || false;
      }
    }
  }
  return false;
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    const workOrderId = url.searchParams.get('workOrderId');
    
    if (!dataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const hasPermission = await checkPermissions(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let svrQuery: admin.firestore.Query = adminDb.collection('serviceVisitReports')
      .where('userId', '==', dataOwnerId);

    if (workOrderId && workOrderId !== 'all') {
      svrQuery = svrQuery.where('workOrderId', '==', workOrderId);
    }
    
    const snapshot = await svrQuery.get();
    
    let allReports: ServiceVisitReport[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceVisitReport));
    
    // Sort in code to avoid needing a composite index
    allReports.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

    return NextResponse.json(allReports, { status: 200 });

  } catch (error: any) {
    console.error('SVR_API_GET Error:', error);
    if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('query requires an index'))) {
      return NextResponse.json({ error: 'Database Index Required', details: "A Firestore index is required for this query. Check server logs.", code: 'FIRESTORE_INDEX_REQUIRED' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const actorUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = svrCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    const { dataOwnerId, ...data } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(actorUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'Actor profile not found.' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;

    const hasPermission = await checkPermissions(actorUid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden: You do not have permission to log SVRs.' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;

    let svrCost = SERVICE_VISIT_REPORT_CREATION_COST;
    let expenseCost = EXPENSE_RECORDING_COST;
    try {
        const appConfigSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            svrCost = configData.actionCosts?.find(c => c.key === "SERVICE_VISIT_REPORT_CREATION_COST")?.cost ?? SERVICE_VISIT_REPORT_CREATION_COST;
            expenseCost = configData.actionCosts?.find(c => c.key === 'EXPENSE_RECORDING_COST')?.cost ?? EXPENSE_RECORDING_COST;
        }
    } catch (configError) { console.warn("SVR POST: Error fetching app config for cost, using default"); }
    
    const consumedItemsWithValue = data.consumedItems?.filter(item => item.consumedQuantity > 0) || [];
    const totalConsumedValue = consumedItemsWithValue.reduce((sum, item) => sum + item.amount, 0);
    
    let totalCost = svrCost;
    if (totalConsumedValue > 0) {
        totalCost += expenseCost;
    }


    if ((pointPayerProfileData.resourcePoints ?? 0) < totalCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${totalCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const workOrderDocRef = adminDb.collection('workOrders').doc(data.workOrderId);
    const workOrderSnap = await workOrderDocRef.get();
    if (!workOrderSnap.exists || workOrderSnap.data()?.userId !== dataOwnerId) {
      return NextResponse.json({ error: 'Work Order not found or access denied.' }, { status: 404 });
    }
    const workOrderData = workOrderSnap.data() as WorkOrder;

    const now = new Date().toISOString();
    const newSvrData: Omit<ServiceVisitReport, 'id'> = {
      userId: dataOwnerId,
      createdBy: actorUid,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      workOrderId: data.workOrderId,
      workOrderNumber: workOrderData.workOrderNumber,
      visitDate: data.visitDate,
      purposeOfVisit: data.purposeOfVisit,
      actionsTaken: data.actionsTaken,
      nextSteps: data.nextSteps || null,
      clientFeedback: data.clientFeedback || null,
      visitRating: data.visitRating,
      consumedItems: consumedItemsWithValue,
      createdAt: now,
      updatedAt: now,
    };

    const batch = adminDb.batch();
    const newSvrRef = adminDb.collection('serviceVisitReports').doc();
    batch.set(newSvrRef, newSvrData);

    if (totalConsumedValue > 0) {
        const expenseData: Omit<Expense, 'id'> = {
            userId: dataOwnerId,
            createdByName: `System (via SVR)`,
            date: data.visitDate,
            category: 'Materials Consumed (Service)',
            description: `Materials consumed during service visit for WO #${workOrderData.workOrderNumber}`,
            amount: totalConsumedValue,
            receiptUrl: null,
            companyId: workOrderData.companyId,
            companyName: workOrderData.companyName,
            workOrderId: data.workOrderId,
            workOrderNumber: workOrderData.workOrderNumber,
            createdAt: now,
            updatedAt: now,
            updatedBy: actorUid,
            updatedByName: actorProfile.fullName || 'User',
        };
        const newExpenseRef = adminDb.collection('expenses').doc();
        batch.set(newExpenseRef, expenseData);
    }
    
    batch.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-totalCost) });
    
    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId,
      actorUid,
      actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'svr_created',
      entityType: 'ServiceVisitReport',
      entityId: newSvrRef.id,
      entityName: `SVR for WO#${workOrderData.workOrderNumber} on ${newSvrData.visitDate}`,
      details: { message: `SVR created for ${workOrderData.workOrderNumber}.`, cost: totalCost }
    });
    
    return NextResponse.json({ id: newSvrRef.id, ...newSvrData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - totalCost }, { status: 201 });
  } catch (error: any) {
    console.error("API /api/svr POST error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
