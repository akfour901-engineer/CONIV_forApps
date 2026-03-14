


import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, Estimate, WorkOrder } from '@/types';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const listDocumentsSchema = z.object({
  dataOwnerId: z.string().min(1, 'dataOwnerId is required.'),
  documentType: z.enum(['estimates', 'workOrders']),
});

export async function POST(request: Request) {
  const functionCallId = `api_list_documents_POST_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token', details: error.message }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = listDocumentsSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { dataOwnerId, documentType } = validationResult.data;

    let canAccess = false;
    if (authenticatedUserUid === dataOwnerId) {
        canAccess = true;
    } else {
        const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
        if (authUserProfileDoc.exists && authUserProfileDoc.data()?.ownerId === dataOwnerId) {
            const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if(teamMemberDocSnap.exists) {
                const teamMemberData = teamMemberDocSnap.data() as TeamMember;
                // Check for a permission that would likely grant access to this data
                if (teamMemberData.permissions?.canUseAiRiskAssessment || teamMemberData.permissions?.canViewEstimates || teamMemberData.permissions?.canViewWorkOrders) {
                    canAccess = true;
                }
            }
        }
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });
    }

    const documentsSnapshot = await adminDb.collection(documentType)
      .where('userId', '==', dataOwnerId)
      .orderBy('createdAt', 'desc')
      .get();
      
    const documents = documentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estimate | WorkOrder));
    
    return NextResponse.json(documents, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/list-documents:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
