


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { DailyProgressReport, UserProfile, TeamMember, AppConfiguration, WorkOrder, Expense } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { DPR_CREATION_COST, EXPENSE_RECORDING_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const dprConsumedItemSchema = z.object({
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

const dprCreateSchema = z.object({
  workOrderId: z.string().min(1, "Work Order is required."),
  reportDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid report date." }),
  workUpToYesterday: z.string().min(1, "This field is required.").max(2000),
  todaysPlanning: z.string().min(1, "This field is required.").max(2000),
  todaysWorkAllocation: z.string().min(1, "This field is required.").max(2000),
  todaysCompletion: z.string().min(1, "This field is required.").max(2000),
  workRating: z.coerce.number().min(1).max(10),
  sitePhotos: z.array(z.string()).max(5).optional().nullable(), // Allow URLs or base64
  consumedItems: z.array(dprConsumedItemSchema).optional().nullable(),
  dataOwnerId: z.string().min(1), // Added for explicit context
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
        return (teamMemberDocSnap.data() as TeamMember).permissions?.canManageDpr || false;
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

    let dprQuery: admin.firestore.Query = adminDb.collection('dailyProgressReports')
      .where('userId', '==', dataOwnerId);

    if (workOrderId && workOrderId !== 'all') {
      dprQuery = dprQuery.where('workOrderId', '==', workOrderId);
    }
    
    const snapshot = await dprQuery.get();
    
    let allReports: DailyProgressReport[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyProgressReport));
    
    // Sort in code to avoid needing a composite index
    allReports.sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());

    return NextResponse.json(allReports, { status: 200 });

  } catch (error: any) {
    console.error('API /api/dpr GET error:', error);
    if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('query requires an index'))) {
      const detailedErrorMessage = "A Firestore index is required for this query. The query is likely on 'dailyProgressReports' filtering by 'userId'. Please check server logs for a link to create the necessary index.";
      return NextResponse.json({ error: 'Database Index Required', details: detailedErrorMessage, code: 'FIRESTORE_INDEX_REQUIRED' }, { status: 500 });
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
    const validationResult = dprCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    const { dataOwnerId, ...data } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(actorUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'Actor profile not found.' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;

    const hasPermission = await checkPermissions(actorUid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden: You do not have permission to log DPRs.' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;

    let dprCost = DPR_CREATION_COST;
    let expenseCost = EXPENSE_RECORDING_COST;
    try {
        const appConfigSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            dprCost = configData.actionCosts?.find(c => c.key === "DPR_CREATION_COST")?.cost ?? DPR_CREATION_COST;
            expenseCost = configData.actionCosts?.find(c => c.key === 'EXPENSE_RECORDING_COST')?.cost ?? EXPENSE_RECORDING_COST;
        }
    } catch (configError) { console.warn("DPR POST: Error fetching app config for cost, using default"); }

    const consumedItemsWithValue = data.consumedItems?.filter(item => item.consumedQuantity > 0) || [];
    const totalConsumedValue = consumedItemsWithValue.reduce((sum, item) => sum + item.amount, 0);
    
    let totalCost = dprCost;
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
    const newDprData: Omit<DailyProgressReport, 'id'> = {
      userId: dataOwnerId,
      createdBy: actorUid,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      workOrderId: data.workOrderId,
      workOrderNumber: workOrderData.workOrderNumber,
      companyId: workOrderData.companyId,
      reportDate: data.reportDate,
      workUpToYesterday: data.workUpToYesterday,
      todaysPlanning: data.todaysPlanning,
      todaysWorkAllocation: data.todaysWorkAllocation,
      todaysCompletion: data.todaysCompletion,
      workRating: data.workRating,
      sitePhotos: data.sitePhotos || null,
      consumedItems: consumedItemsWithValue,
      createdAt: now,
      updatedAt: now,
    };

    const batch = adminDb.batch();
    const newDprRef = adminDb.collection('dailyProgressReports').doc();
    batch.set(newDprRef, newDprData);

    if (totalConsumedValue > 0) {
        const expenseData: Omit<Expense, 'id'> = {
            userId: dataOwnerId,
            createdByName: `System (via DPR)`,
            date: data.reportDate,
            category: 'Materials Consumed',
            description: `Materials consumed as per DPR for WO #${workOrderData.workOrderNumber} on ${data.reportDate}`,
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
      actionType: 'dpr_created',
      entityType: 'DailyProgressReport',
      entityId: newDprRef.id,
      entityName: `DPR for WO#${workOrderData.workOrderNumber} on ${newDprData.reportDate}`,
      details: { message: `DPR created for ${workOrderData.workOrderNumber}.`, cost: totalCost }
    });
    
    return NextResponse.json({ id: newDprRef.id, ...newDprData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - totalCost }, { status: 201 });
  } catch (error: any) {
    console.error("API /api/dpr POST error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
