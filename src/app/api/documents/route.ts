

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import * as admin from 'firebase-admin';
import type { UserProfile, TeamMember, Document as AppDocument, DocumentType, WorkOrder, AppConfiguration } from '@/types';
import { DOCUMENT_TYPES_OPTIONS } from '@/lib/constants';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { DOCUMENT_LINKING_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const listDocumentsSchema = z.object({
  dataOwnerId: z.string().min(1, 'dataOwnerId is required.'),
  workOrderId: z.string().optional(),
});

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB
const documentCreateSchema = z.object({
  documentName: z.string().min(1, "Document name is required.").max(255),
  documentType: z.string().refine(val => DOCUMENT_TYPES_OPTIONS.includes(val as DocumentType), { message: "Invalid document type." }),
  documentUrl: z.string().min(1, "A file must be uploaded.").max(MAX_FILE_SIZE_BYTES * 1.5, "Document URL/data too large. Max 3MB."), // Allow for base64 overhead
  workOrderIdForLinking: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1, "Data owner context is required."),
});

async function canAccessDocuments(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === requestedDataOwnerId) return true;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) return false;
  
  const authUserProfile = authUserProfileDoc.data() as UserProfile;
  if (authUserProfile.ownerId === requestedDataOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      return teamMemberData.permissions?.canManageDocuments || false;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const functionCallId = `api_documents_GET_${Date.now()}`;
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token', details: error.message }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    const workOrderId = url.searchParams.get('workOrderId');

    if (!dataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId is required.' }, { status: 400 });
    }
    
    const hasPermission = await canAccessDocuments(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });
    }
    
    let query = adminDb.collection('documents').where('userId', '==', dataOwnerId);
    if(workOrderId) {
        query = query.where('workOrderId', '==', workOrderId);
    }

    const documentsSnapshot = await query.orderBy('dateUploaded', 'desc').get();
      
    const documents = documentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppDocument));
    
    return NextResponse.json(documents, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/documents:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const functionCallId = `api_documents_POST_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = documentCreateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { dataOwnerId, ...dataFromClient } = validationResult.data;

    const hasPermission = await canAccessDocuments(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'Actor profile not found.' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    
    let actualCost = DOCUMENT_LINKING_COST;
    try {
      const appConfigSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
      if (appConfigSnap.exists) {
        const configData = appConfigSnap.data() as AppConfiguration;
        const costConfig = configData.actionCosts?.find(c => c.key === "DOCUMENT_LINKING_COST");
        if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
      }
    } catch (e) { console.warn("Could not fetch cost config for document creation."); }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    let workOrderNumber: string | null = null;
    if (dataFromClient.workOrderIdForLinking) {
        const woSnap = await adminDb.collection('workOrders').doc(dataFromClient.workOrderIdForLinking).get();
        if (woSnap.exists && woSnap.data()?.userId === dataOwnerId) {
            workOrderNumber = (woSnap.data() as WorkOrder).workOrderNumber;
        }
    }

    const now = new Date().toISOString();
    const newDocumentData: Omit<AppDocument, 'id'> = {
      userId: dataOwnerId,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      documentName: dataFromClient.documentName,
      documentType: dataFromClient.documentType,
      documentUrl: dataFromClient.documentUrl,
      workOrderId: dataFromClient.workOrderIdForLinking || null,
      workOrderNumber: workOrderNumber,
      dateUploaded: now,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };

    const batch = adminDb.batch();
    const newDocRef = adminDb.collection('documents').doc();
    batch.set(newDocRef, newDocumentData);

    batch.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-actualCost) });

    await batch.commit();
    
    await logActivity({
      ownerId: dataOwnerId,
      actorUid: authenticatedUserUid,
      actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'document_upload',
      entityType: 'Document',
      entityId: newDocRef.id,
      entityName: newDocumentData.documentName,
      details: { message: `Document '${newDocumentData.documentName}' uploaded. Cost: ${actualCost} points.` }
    });

    return NextResponse.json({ id: newDocRef.id, ...newDocumentData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost }, { status: 201 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/documents POST:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
