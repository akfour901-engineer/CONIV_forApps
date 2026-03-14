
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { WorkOrder, ChatMessage, UserProfile, TeamMember } from '@/types/server-only';

export const dynamic = 'force-dynamic';

// Helper function for authorization
async function canAccessWorkOrders(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
    const adminDb = getDb();
    if (authenticatedUserUid === requestedDataOwnerId) return true;

    const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (memberProfileDoc.exists) {
        const memberProfile = memberProfileDoc.data() as UserProfile;
        if (memberProfile.ownerId === requestedDataOwnerId) {
            const teamMemberDoc = await adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
            if (teamMemberDoc.exists) {
                const permissions = (teamMemberDoc.data() as TeamMember).permissions;
                // Anyone who can use chat or view WOs should see the list
                return permissions?.canUseProjectChat || permissions?.canViewWorkOrders || false;
            }
        }
    }
    return false;
}

interface WorkOrderWithLatestMessage extends WorkOrder {
    latestMessage: ChatMessage | null;
}

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    if (!dataOwnerId) return NextResponse.json({ error: 'dataOwnerId is required' }, { status: 400 });

    const hasPermission = await canAccessWorkOrders(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 1. Fetch all work orders for the user
    const workOrdersSnapshot = await adminDb.collection('workOrders')
      .where('userId', '==', dataOwnerId)
      .get();
    
    const workOrders: WorkOrder[] = workOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
    
    // 2. Fetch the latest message for each work order individually
    const workOrdersWithMessagesPromises = workOrders.map(async (wo) => {
        if (!wo.id) return { ...wo, latestMessage: null };
        const messagesSnapshot = await adminDb.collection('workOrders').doc(wo.id).collection('chatMessages')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        const latestMessage = messagesSnapshot.empty ? null : { id: messagesSnapshot.docs[0].id, ...messagesSnapshot.docs[0].data() } as ChatMessage;
        
        return {
            ...wo,
            latestMessage,
        };
    });

    const workOrdersWithMessages: WorkOrderWithLatestMessage[] = await Promise.all(workOrdersWithMessagesPromises);
    
    // 3. Sort by the latest message timestamp (or creation date if no messages)
    workOrdersWithMessages.sort((a, b) => {
        const timeA = a.latestMessage ? new Date(a.latestMessage.timestamp).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.latestMessage ? new Date(b.latestMessage.timestamp).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
    });

    return NextResponse.json(workOrdersWithMessages, { status: 200 });

  } catch (error: any) {
    console.error("API GET /api/chat/work-orders error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
