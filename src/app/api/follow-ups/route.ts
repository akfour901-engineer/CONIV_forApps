


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, FollowUp, Organization, AppConfiguration } from '@/types';
import { z } from 'zod';
import { FOLLOW_UP_CREATION_COST } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const followUpCreateSchema = z.object({
  organizationId: z.string().min(1, "Organization is required."),
  visitDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid visit date." }),
  contactPerson: z.string().max(100).optional().nullable(),
  notes: z.string().min(1, "Notes are required.").max(2000),
  reminderDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid reminder date." }),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  dataOwnerId: z.string().min(1), // Explicitly require data context
}).refine(data => new Date(data.reminderDate) >= new Date(data.visitDate), {
  message: "Reminder date must be on or after the visit date.",
  path: ["reminderDate"],
});

async function authorizeAccess(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
    if (authenticatedUserUid === requestedDataOwnerId) {
        return true; 
    }

    const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (memberProfileDoc.exists) {
        const memberProfile = memberProfileDoc.data() as UserProfile;
        if (memberProfile.ownerId === requestedDataOwnerId) {
            const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if (teamMemberDocSnap.exists) {
                const teamMemberData = teamMemberDocSnap.data() as TeamMember;
                if (teamMemberData.permissions?.canManageOrganizations) {
                    return true;
                }
            }
        }
    }
    return false;
}


export async function GET(request: Request) {
  const functionCallId = `api_follow_ups_GET_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    if (!dataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const hasPermission = await authorizeAccess(decodedToken.uid, dataOwnerId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Not authorized to access this data.' }, { status: 403 });
    }

    const snapshot = await adminDb.collection('followUps')
      .where('userId', '==', dataOwnerId)
      .get();
      
    const followUps: FollowUp[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FollowUp));
    
    // Sort in code to avoid composite index requirement
    followUps.sort((a,b) => new Date(b.reminderDate).getTime() - new Date(a.reminderDate).getTime());

    return NextResponse.json(followUps, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/follow-ups GET error:`, error);
    if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('query requires an index'))) {
        return NextResponse.json({ error: 'A database index is required for this query. Check server logs.', code: 'FIRESTORE_INDEX_REQUIRED' }, { status: 500 });
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
    const validationResult = followUpCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    const { dataOwnerId, ...data } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(actorUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'Actor profile not found.' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;

    const hasPermission = await authorizeAccess(actorUid, dataOwnerId);
    if(!hasPermission) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to create follow-ups for this account.' }, { status: 403 });
    }
    
    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;

    let actualCost = FOLLOW_UP_CREATION_COST;
    try {
        const appConfigSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "FOLLOW_UP_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError) { console.warn("Follow-up POST: Error fetching app config for cost, using default"); }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const organizationDocRef = adminDb.collection('organizations').doc(data.organizationId);
    const organizationSnap = await organizationDocRef.get();
    
    if (!organizationSnap.exists) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }
    const organizationData = organizationSnap.data() as Organization;
    
    if (organizationData.visibility !== 'public' && organizationData.userId !== dataOwnerId) {
      return NextResponse.json({ error: 'Organization not found or access denied.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const newFollowUpData: Omit<FollowUp, 'id'> = {
      userId: dataOwnerId,
      organizationId: data.organizationId,
      organizationName: organizationData.name,
      visitDate: data.visitDate,
      contactPerson: data.contactPerson || null,
      notes: data.notes,
      reminderDate: data.reminderDate,
      status: data.status,
      createdAt: now,
      updatedAt: now,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      updatedBy: actorUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };

    const batch = adminDb.batch();
    const newFollowUpRef = adminDb.collection('followUps').doc();
    batch.set(newFollowUpRef, newFollowUpData);
    batch.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-actualCost) });
    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId,
      actorUid,
      actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create',
      entityType: 'FollowUp',
      entityId: newFollowUpRef.id,
      entityName: `Follow-up for ${organizationData.name}`,
      details: { message: `Follow-up created for ${organizationData.name} with reminder on ${data.reminderDate}.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newFollowUpRef.id, ...newFollowUpData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost }, { status: 201 });
  } catch (error: any) {
    console.error("API /api/follow-ups POST error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
