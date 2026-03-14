


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { LabourAdvance, UserProfile, TeamMember, LabourRegister, WorkOrder, Expense, AppConfiguration } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { LABOUR_PAYMENT_RECORDING_COST } from '@/lib/constants';
import { recalculateLabourerTotals } from '@/lib/server-utils';
export const dynamic = 'force-dynamic';
const labourAdvanceCreateSchema = z.object({
  workOrderId: z.string().min(1, "Work Order ID is required."),
  labourRegisterId: z.string().min(1, "Labourer ID is required."),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format." }),
  amount: z.coerce.number().positive("Amount must be a positive number."),
  description: z.string().max(500).optional().nullable(),
  documentUrl: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1, "Data owner context is required."), // Added for explicit context
});

export async function GET(request: Request) {
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const actorUid = decodedToken.uid;

        const actorProfileDoc = await adminDb.collection('users').doc(actorUid).get();
        if (!actorProfileDoc.exists) return NextResponse.json({ error: 'Actor profile not found.' }, { status: 403 });
        const actorProfile = actorProfileDoc.data() as UserProfile;
        const dataOwnerId = actorProfile.ownerId || actorUid;

        const url = new URL(request.url);
        const labourerId = url.searchParams.get('labourerId');
        
        let query: admin.firestore.Query = adminDb.collection('labourAdvances').where('userId', '==', dataOwnerId);

        if(labourerId) {
            query = query.where('labourRegisterId', '==', labourerId);
        }

        const snapshot = await query.get();
        const advances = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabourAdvance));

        // Sort in code to avoid needing a composite index
        advances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(advances, { status: 200 });

    } catch (error: any) {
        console.error("Error fetching labour advances:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    const idToken = await adminAuth.verifyIdToken(authorizationHeader.split('Bearer ')[1]);
    
    const actorUid = idToken.uid;
    const actorProfileSnap = await adminDb.collection('users').doc(actorUid).get();
    if(!actorProfileSnap.exists) throw new Error('Actor profile not found');
    const actorProfile = actorProfileSnap.data() as UserProfile;

    const requestBody = await request.json();
    const validationResult = labourAdvanceCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    const { dataOwnerId, workOrderId, labourRegisterId, date, amount, description, documentUrl } = validationResult.data;
    
    // Authorization Check
    let canManagePayments = false;
    if (actorUid === dataOwnerId) {
        canManagePayments = true;
    } else {
        const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(actorUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if(teamMemberData.permissions?.canManageLabourPayments) canManagePayments = true;
        }
    }
    if(!canManagePayments) return NextResponse.json({ error: 'Forbidden: You do not have permission to manage labour payments.' }, { status: 403 });

    const workOrderDocRef = adminDb.collection('workOrders').doc(workOrderId);
    const labourerDocRef = adminDb.collection('labourRegisters').doc(labourRegisterId);
    
    const [workOrderSnap, labourerDocSnap] = await Promise.all([workOrderDocRef.get(), labourerDocRef.get()]);

    if (!workOrderSnap.exists || workOrderSnap.data()?.userId !== dataOwnerId) {
      return NextResponse.json({ error: 'Associated Work Order not found or access denied.' }, { status: 404 });
    }
    if (!labourerDocSnap.exists || labourerDocSnap.data()?.userId !== dataOwnerId) {
        return NextResponse.json({ error: 'Labourer not found or does not belong to your data scope.' }, { status: 404 });
    }
    const workOrderData = workOrderSnap.data() as WorkOrder;
    const labourerData = labourerDocSnap.data() as LabourRegister;

    // --- Coin Deduction Logic ---
    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_LABOUR_ADVANCE_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = LABOUR_PAYMENT_RECORDING_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "LABOUR_PAYMENT_RECORDING_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`API /labour-advances POST: Error fetching app config for cost, using default: ${actualCost}.`);
    }
    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    // --- End Coin Deduction Logic ---

    const newAdvanceRef = adminDb.collection('labourAdvances').doc();
    const newExpenseRef = adminDb.collection('expenses').doc();
    
    await adminDb.runTransaction(async (transaction) => {
        const now = new Date().toISOString();

        const advanceData: Omit<LabourAdvance, 'id'> = {
          userId: dataOwnerId, workOrderId, workOrderNumber: workOrderData.workOrderNumber,
          labourRegisterId, labourerName: labourerData.workerName, date, amount,
          description: description || null, documentUrl: documentUrl || null,
          createdAt: now, updatedAt: now, createdByName: actorProfile.fullName || actorProfile.email || "User",
          updatedBy: actorUid, updatedByName: actorProfile.fullName || actorProfile.email || "User",
        };
        transaction.set(newAdvanceRef, advanceData);

        const expenseData: Omit<Expense, 'id'> = {
            userId: dataOwnerId, createdByName: `System (via Labour Advance)`, date: date,
            category: 'Labour Advance/Payment', description: `Advance paid to ${labourerData.workerName} for WO #${workOrderData.workOrderNumber}`,
            amount: amount, receiptUrl: documentUrl || null, companyId: labourerData.companyId, companyName: labourerData.companyName,
            workOrderId: workOrderId, workOrderNumber: workOrderData.workOrderNumber, createdAt: now, updatedAt: now,
            updatedBy: actorUid, updatedByName: actorProfile.fullName || 'User',
        };
        transaction.set(newExpenseRef, expenseData);
        
        // Deduct points
        transaction.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-actualCost) });
        
        // Recalculate labourer totals
        await recalculateLabourerTotals(labourRegisterId, transaction);
    });

    await logActivity({
        ownerId: dataOwnerId, actorUid: actorUid, actorName: actorProfile.fullName || actorProfile.email || "User",
        actionType: 'payment_recorded', entityType: 'LabourAdvance', entityId: newAdvanceRef.id,
        entityName: `Advance for ${labourerData.workerName}`,
        details: { message: `Advance of ${amount} paid to ${labourerData.workerName} for WO #${workOrderData.workOrderNumber}`, cost: actualCost }
    });
    
    await logActivity({
        ownerId: dataOwnerId, actorUid: actorUid, actorName: `System (via ${actorProfile.fullName || actorProfile.email})`,
        actionType: 'create', entityType: 'Expense', entityId: newExpenseRef.id,
        entityName: `Expense for Labour Advance`, details: `Auto-recorded expense of ${amount} for labour advance.`
    });

    return NextResponse.json({ id: newAdvanceRef.id, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost }, { status: 201 });

  } catch (error: any) {
    console.error("Error in /api/labour-advances POST:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
