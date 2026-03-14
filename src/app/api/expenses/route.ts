



import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { Expense, Company, WorkOrder, UserProfile, TeamMember, AppConfiguration } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { EXPENSE_RECORDING_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const expenseCreateSchema = z.object({
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid expense date." }),
  category: z.string().min(1, "Category is required.").max(100),
  description: z.string().min(1, "Description is required.").max(500),
  amount: z.coerce.number().positive("Amount must be positive."),
  receiptUrl: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  workOrderId: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1), // Explicitly require data context
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
            if (teamMemberData.permissions?.canManageExpenses) canAccess = true;
          }
        }
      }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    const expensesSnapshot = await adminDb.collection('expenses')
      .where('userId', '==', requestedDataOwnerId)
      .orderBy('date', 'desc')
      .get();
    const expenses: Expense[] = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    return NextResponse.json(expenses, { status: 200 });

  } catch (error: any) {
    console.error('API /api/expenses GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const functionCallId = `api_expenses_POST_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = expenseCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...dataFromClient } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;
    
    // Corrected Authorization Logic
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) {
        canCreate = true;
    } else {
        // Check if the actor is a member of the dataOwner's team.
        const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            // Check if their owner ID in their profile matches who they are trying to act for. This prevents spoofing.
            if(actorProfile.ownerId === dataOwnerId && teamMemberData.permissions?.canManageExpenses) {
              canCreate = true;
            }
        }
    }
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create expenses for this account.' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_EXPENSE_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = EXPENSE_RECORDING_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "EXPENSE_RECORDING_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /expenses POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    let companyName: string | null = null;
    if (dataFromClient.companyId) {
      const companyDocRef = adminDb.collection('companies').doc(dataFromClient.companyId);
      const companySnap = await companyDocRef.get();
      if (companySnap.exists && companySnap.data()?.userId === dataOwnerId) {
        companyName = (companySnap.data() as Company).name;
      }
    }

    let workOrderNumber: string | null = null;
    if (dataFromClient.workOrderId) {
      const woDocRef = adminDb.collection('workOrders').doc(dataFromClient.workOrderId);
      const woSnap = await woDocRef.get();
      if (woSnap.exists && woSnap.data()?.userId === dataOwnerId) {
        workOrderNumber = (woSnap.data() as WorkOrder).workOrderNumber;
      }
    }
    const now = new Date().toISOString();
    const newExpenseData: Omit<Expense, 'id'> = {
      userId: dataOwnerId,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      date: dataFromClient.date,
      category: dataFromClient.category,
      description: dataFromClient.description,
      amount: dataFromClient.amount,
      receiptUrl: dataFromClient.receiptUrl || null,
      companyId: dataFromClient.companyId || null,
      companyName: companyName,
      workOrderId: dataFromClient.workOrderId || null,
      workOrderNumber: workOrderNumber,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };
    
    const cleanedData: { [key: string]: any } = {};
    for (const key in newExpenseData) {
        if (newExpenseData[key as keyof typeof newExpenseData] !== undefined) {
            cleanedData[key] = newExpenseData[key as keyof typeof newExpenseData];
        }
    }

    const batch = adminDb.batch();
    const newExpenseRef = adminDb.collection('expenses').doc();
    batch.set(newExpenseRef, cleanedData);

    // Deduct points in the same batch
    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });
    
    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create', entityType: 'Expense', entityId: newExpenseRef.id, entityName: newExpenseData.description,
      details: {
        message: `Expense of ${newExpenseData.amount} in ${newExpenseData.category} recorded.`,
        cost: actualCost
      }
    });
    
    return NextResponse.json({ id: newExpenseRef.id, ...newExpenseData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/expenses POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
