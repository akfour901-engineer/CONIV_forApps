


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { Subcontractor, UserProfile, TeamMember, AppConfiguration } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { SUBCONTRACTOR_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const subcontractorCreateSchema = z.object({
  name: z.string().min(2, "Name is required.").max(100),
  specialization: z.string().min(2, "Specialization is required.").max(100),
  contactPerson: z.string().max(100).optional().nullable(),
  email: z.string().email("Invalid email.").optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  rating: z.coerce.number().min(1).max(5).default(3),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive', 'on_hold']).default('active'),
  dataOwnerId: z.string().min(1, "Data owner context is required."),
});

async function canManageSubcontractors(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === requestedDataOwnerId) return true;
  const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (memberProfileDoc.exists) {
    const memberProfile = memberProfileDoc.data() as UserProfile;
    if (memberProfile.ownerId === requestedDataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        return teamMemberData.permissions?.canManageSubcontractors || false;
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
    
    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    if (!dataOwnerId) return NextResponse.json({ error: 'dataOwnerId is required' }, { status: 400 });

    const hasPermission = await canManageSubcontractors(decodedToken.uid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const snapshot = await adminDb.collection('subcontractors')
      .where('userId', '==', dataOwnerId)
      .get();

    const subcontractors: Subcontractor[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subcontractor));
    
    // Server-side sorting, even though we fetch all. This is a minimal-change approach.
    subcontractors.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(subcontractors, { status: 200 });
  } catch (error: any) {
    console.error('API GET /api/subcontractors error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = subcontractorCreateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { dataOwnerId, ...dataFromClient } = validationResult.data;

    const hasPermission = await canManageSubcontractors(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create subcontractors.' }, { status: 403 });
    }

    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'User profile not found.' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction.' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = SUBCONTRACTOR_CREATION_COST;
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "SUBCONTRACTOR_CREATION_COST");
            if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
    } catch (e) { console.warn("Could not fetch cost config for SUBCONTRACTOR_CREATION_COST."); }
    
    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const now = new Date().toISOString();
    const newSubcontractorData: Omit<Subcontractor, 'id'> = {
      userId: dataOwnerId,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      ...dataFromClient,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };
    
    const cleanedData: { [key: string]: any } = {};
    for (const key in newSubcontractorData) {
        if (newSubcontractorData[key as keyof typeof newSubcontractorData] !== undefined) {
            cleanedData[key] = newSubcontractorData[key as keyof typeof newSubcontractorData];
        }
    }

    const batch = adminDb.batch();
    const newSubcontractorRef = adminDb.collection('subcontractors').doc();
    batch.set(newSubcontractorRef, cleanedData);

    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });

    await batch.commit();
    
    const newResourcePoints = (pointPayerProfileData.resourcePoints ?? 0) - actualCost;
    
    await logActivity({
      ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create', entityType: 'Subcontractor', entityId: newSubcontractorRef.id, entityName: newSubcontractorData.name,
      details: { message: `Subcontractor '${newSubcontractorData.name}' created.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newSubcontractorRef.id, ...newSubcontractorData, newResourcePoints, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API POST /api/subcontractors error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
