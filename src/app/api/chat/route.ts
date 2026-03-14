import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { TeamMember, UserProfile, AppConfiguration, ChatMessage } from '@/types/server-only';
import { CHAT_MESSAGE_COST } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const dynamic = 'force-dynamic';
const messageSchema = z.object({
  workOrderId: z.string().min(1, "Work Order ID is required."),
  text: z.string().optional(),
  imageUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.4, `File is too large. Max ${MAX_FILE_SIZE_MB}MB.`).optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
}).refine(data => data.text || data.imageUrl, {
  message: "Either text or an image URL must be provided.",
});

async function canAccessChat(authenticatedUserUid: string, workOrderId: string): Promise<{ authorized: boolean; dataOwnerId?: string }> {
    const adminDb = getDb();
    const woDoc = await adminDb.collection('workOrders').doc(workOrderId).get();
    if (!woDoc.exists) return { authorized: false };
    const woOwnerId = woDoc.data()!.userId;

    if (authenticatedUserUid === woOwnerId) {
        return { authorized: true, dataOwnerId: woOwnerId };
    }

    const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (memberProfileDoc.exists && (memberProfileDoc.data() as UserProfile).ownerId === woOwnerId) {
        const teamMemberDoc = await adminDb.collection('users').doc(woOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
        if (teamMemberDoc.exists) {
            const permissions = (teamMemberDoc.data() as TeamMember).permissions;
            if (permissions?.canUseProjectChat) {
                return { authorized: true, dataOwnerId: woOwnerId };
            }
        }
    }

    return { authorized: false };
}


export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);

    const url = new URL(request.url);
    const workOrderId = url.searchParams.get('workOrderId');
    if (!workOrderId) return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });

    const authResult = await canAccessChat(decodedToken.uid, workOrderId);
    if (!authResult.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // **FIX:** Changed from a collectionGroup query to a direct collection query to avoid needing a complex index.
    const messagesSnapshot = await adminDb
      .collection('workOrders')
      .doc(workOrderId)
      .collection('chatMessages')
      .orderBy('timestamp', 'asc')
      .get();
      
    let messages: ChatMessage[] = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
    
    // The sorting is now handled by the Firestore query itself.
    
    // Optionally limit the number of messages returned if performance is a concern
    if (messages.length > 500) {
        messages = messages.slice(messages.length - 500);
    }
    
    return NextResponse.json(messages, { status: 200 });

  } catch (error: any) {
    console.error("API GET /api/chat error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const requestBody = await request.json();
    const validationResult = messageSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { workOrderId, text, imageUrl, fileName, fileType } = validationResult.data;
    const authResult = await canAccessChat(decodedToken.uid, workOrderId);
    if (!authResult.authorized || !authResult.dataOwnerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    const actorProfileSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!actorProfileSnap.exists) throw new Error("Actor profile not found.");
    const actorProfile = actorProfileSnap.data() as UserProfile;
    
    const pointPayerProfileRef = adminDb.collection('users').doc(authResult.dataOwnerId);
    let actualCost = CHAT_MESSAGE_COST;
    try {
      const appConfigSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
      if (appConfigSnap.exists) {
          const configData = appConfigSnap.data() as AppConfiguration;
          const costConfig = configData.actionCosts?.find(c => c.key === 'CHAT_MESSAGE_COST');
          if (costConfig?.cost !== undefined) actualCost = costConfig.cost;
      }
    } catch(e) {
      console.warn("Could not fetch cost config for Chat Message, using default.");
    }
    
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
      throw new Error("Point Payer profile not found.");
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient points to send a message. Required: ${actualCost}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const newMessage: Omit<ChatMessage, 'id'> = {
      userId: decodedToken.uid,
      senderName: actorProfile.fullName || actorProfile.email || 'User',
      workOrderId,
      text: text || '',
      imageUrl: imageUrl || '',
      fileName: fileName || null,
      fileType: fileType || null,
      timestamp: new Date().toISOString(),
    };
    
    const batch = adminDb.batch();
    // **FIX:** The path now correctly points to the subcollection within the work order.
    const newMessageRef = adminDb.collection('workOrders').doc(workOrderId).collection('chatMessages').doc();
    batch.set(newMessageRef, newMessage);

    const currentPoints = pointPayerProfileData.resourcePoints ?? 0;
    const newResourcePoints = parseFloat((currentPoints - actualCost).toFixed(4));


    if (actualCost > 0) {
        batch.update(pointPayerProfileRef, { 
            resourcePoints: newResourcePoints,
            resourcePointsLastUpdated: new Date().toISOString(),
        });
    }

    await batch.commit();

    const workOrderNumber = (await adminDb.collection('workOrders').doc(workOrderId).get()).data()?.workOrderNumber || 'N/A';
    
    await logActivity({
      ownerId: authResult.dataOwnerId,
      actorUid: decodedToken.uid,
      actorName: actorProfile.fullName || "User",
      actionType: 'create',
      entityType: 'ChatMessage',
      entityId: newMessageRef.id,
      entityName: `Message in WO# ${workOrderNumber}`,
      details: {
        message: text ? `Sent message: "${text.substring(0, 50)}..."` : "Sent a file.",
        cost: actualCost,
      },
    });

    const createdMessage = { id: newMessageRef.id, ...newMessage };

    return NextResponse.json({ ...createdMessage, newResourcePoints }, { status: 201 });
  } catch (error: any) {
    console.error("API POST /api/chat error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
