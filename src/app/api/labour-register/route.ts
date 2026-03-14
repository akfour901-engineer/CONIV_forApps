


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { LabourRegister, WorkOrder, UserProfile, TeamMember, AppConfiguration } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { LABOUR_ENTRY_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const labourRegisterCreateSchema = z.object({
  workerName: z.string().min(2, "Worker name is required.").max(100),
  role: z.string().min(2, "Role is required.").max(100),
  dailyWage: z.coerce.number().min(0, "Daily wage must be non-negative."),
  workOrderId: z.string().min(1, "Work Order is required."),
  dataOwnerId: z.string().min(1), // Explicitly require context
});

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    const workOrderId = url.searchParams.get('workOrderId'); // New filter parameter

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
            if (teamMemberData.permissions?.canManageLabourRegister) canAccess = true;
          }
        }
      }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    let labourQuery: admin.firestore.Query = adminDb.collection('labourRegisters')
      .where('userId', '==', requestedDataOwnerId);

    if (workOrderId && workOrderId !== 'all') {
      labourQuery = labourQuery.where('workOrderId', '==', workOrderId);
    }

    const labourSnapshot = await labourQuery.get();
    const labourers: LabourRegister[] = labourSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabourRegister));
    
    labourers.sort((a,b) => a.workerName.localeCompare(b.workerName));

    return NextResponse.json(labourers, { status: 200 });
  } catch (error: any) {
    console.error('API /api/labour-register GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const functionCallId = `api_labour_register_POST_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = labourRegisterCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...labourDataFromClient } = validationResult.data;

    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!userProfileDoc.exists) return NextResponse.json({ error: 'User profile not found for authenticated user' }, { status: 403 });
    const userProfile = userProfileDoc.data() as UserProfile;
    
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) {
      canCreate = true;
    } else if (userProfile.ownerId === dataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageLabourRegister) canCreate = true;
      }
    }
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to add labourers for this account.' }, { status: 403 });
    }
    
    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_LABOUR_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = LABOUR_ENTRY_CREATION_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "LABOUR_ENTRY_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /labour-register POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const workOrderDocRef = adminDb.collection('workOrders').doc(labourDataFromClient.workOrderId);
    const workOrderSnap = await workOrderDocRef.get();
    if (!workOrderSnap.exists || workOrderSnap.data()?.userId !== dataOwnerId) {
        return NextResponse.json({ error: 'Work Order not found or access denied.' }, { status: 404 });
    }
    const workOrderData = workOrderSnap.data() as WorkOrder;

    const now = new Date().toISOString();
    const newLabourerData: Omit<LabourRegister, 'id'> = {
      userId: dataOwnerId,
      createdByName: userProfile.fullName || userProfile.email || "User",
      companyId: workOrderData.companyId,
      companyName: workOrderData.companyName,
      organizationId: workOrderData.organizationId,
      organizationName: workOrderData.organizationName,
      workOrderId: labourDataFromClient.workOrderId,
      workOrderNumber: workOrderData.workOrderNumber,
      workerName: labourDataFromClient.workerName,
      role: labourDataFromClient.role,
      dailyWage: labourDataFromClient.dailyWage,
      medicalCertificateUrl: null,
      medicalCertificateNumber: null,
      medicalCertificateExpiry: null,
      nocUrl: null,
      nocNumber: null,
      nocExpiry: null,
      identityProofUrl: null,
      identityProofNumber: null,
      gatePassUrl: null,
      gatePassNumber: null,
      gatePassExpiry: null,
      totalDaysWorked: 0,
      totalAmount: 0,
      advancesPaid: 0,
      netAmount: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: userProfile.fullName || userProfile.email || "User",
    };

    const batch = adminDb.batch();
    const docRef = adminDb.collection('labourRegisters').doc();
    batch.set(docRef, newLabourerData);
    
    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });

    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: userProfile.fullName || userProfile.email || "User",
      actionType: 'create', entityType: 'LabourRegister', entityId: docRef.id, entityName: newLabourerData.workerName,
      details: { message: `Labourer ${newLabourerData.workerName} added to WO ${workOrderData.workOrderNumber}.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: docRef.id, ...newLabourerData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/labour-register POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
