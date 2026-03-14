


import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, Document as AppDocument } from '@/types';
import { DOCUMENT_TYPES_OPTIONS } from '@/lib/constants';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const documentUpdateSchema = z.object({
  documentName: z.string().min(1, "Document name is required.").max(255).optional(),
  documentType: z.string().refine(val => DOCUMENT_TYPES_OPTIONS.includes(val as any), { message: "Invalid document type." }).optional(),
  documentUrl: z.string().optional().nullable(),
  workOrderIdForLinking: z.string().optional().nullable(),
});

async function authorizeAccess(
  docId: string,
  authenticatedUserUid: string
): Promise<{ authorized: boolean; documentData?: AppDocument; dataOwnerId?: string; error?: string; status?: number }> {
    const docRef = adminDb.collection('documents').doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        return { authorized: false, error: 'Document not found', status: 404 };
    }
    
    const documentData = { id: docSnap.id, ...docSnap.data() } as AppDocument;
    const itemOwnerId = documentData.userId;
    
    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;
    const actorDataOwnerContext = authUserProfile.ownerId || authenticatedUserUid;

    if (itemOwnerId !== actorDataOwnerContext) {
        return { authorized: false, error: 'Forbidden: This document does not belong to your data scope.', status: 403 };
    }

    if (authenticatedUserUid === itemOwnerId) {
        return { authorized: true, documentData, dataOwnerId: itemOwnerId };
    }

    if (authUserProfile.ownerId === itemOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageDocuments) {
                return { authorized: true, documentData, dataOwnerId: itemOwnerId };
            }
        }
    }
    
    return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { id: string } }) {
    const documentId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const authResult = await authorizeAccess(documentId, decodedToken.uid);
        if (!authResult.authorized || !authResult.documentData) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        
        return NextResponse.json(authResult.documentData, { status: 200 });
    } catch (error: any) {
        console.error(`API /api/documents/[${documentId}] GET error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const documentId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        
        const authResult = await authorizeAccess(documentId, decodedToken.uid);
        if (!authResult.authorized || !authResult.documentData || !authResult.dataOwnerId) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const requestBody = await request.json();
        const validationResult = documentUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
        }
        
        const dataFromClient = validationResult.data;
        
        const dataToUpdate: Partial<AppDocument> = { 
            ...dataFromClient, 
            workOrderId: dataFromClient.workOrderIdForLinking,
            updatedAt: new Date().toISOString(),
            updatedBy: decodedToken.uid,
        };
        
        if (dataFromClient.workOrderIdForLinking && dataFromClient.workOrderIdForLinking !== authResult.documentData.workOrderId) {
            const woSnap = await adminDb.collection('workOrders').doc(dataFromClient.workOrderIdForLinking).get();
            if (woSnap.exists) {
                dataToUpdate.workOrderNumber = woSnap.data()?.workOrderNumber;
            }
        } else if (dataFromClient.workOrderIdForLinking === null) {
            dataToUpdate.workOrderNumber = null;
        }

        const docRef = adminDb.collection('documents').doc(documentId);
        await docRef.update(dataToUpdate);

        const updatedDoc = await docRef.get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (error: any) {
        console.error(`API /api/documents/[${documentId}] PUT error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}


export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const documentId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const authResult = await authorizeAccess(documentId, decodedToken.uid);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        
        await adminDb.collection('documents').doc(documentId).delete();
        
        return NextResponse.json({ message: 'Document deleted successfully.' }, { status: 200 });

    } catch (error: any) {
        console.error(`API /api/documents/[${documentId}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
