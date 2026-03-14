


import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { FollowUp, UserProfile, TeamMember, Organization } from '@/types';
import { z } from 'zod';
import { format } from 'date-fns';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const followUpUpdateSchema = z.object({
    organizationId: z.string().min(1, "Organization is required.").optional(),
    visitDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid visit date." }).optional(),
    contactPerson: z.string().max(100).optional().nullable(),
    notes: z.string().min(1, "Notes are required.").max(2000).optional(),
    reminderDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid reminder date." }).optional(),
    status: z.enum(['pending', 'completed', 'cancelled']).optional(),
}).partial();

async function authorizeAccess(
  followUpId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; followUpData?: FollowUp; dataOwnerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
    const docRef = adminDb.collection('followUps').doc(followUpId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        return { authorized: false, error: 'Follow-up not found', status: 404 };
    }
    
    const followUpData = { id: docSnap.id, ...docSnap.data() } as FollowUp;
    const itemOwnerId = followUpData.userId;
    
    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
    }
    const actorProfile = { uid: actorProfileDoc.id, ...actorProfileDoc.data() } as UserProfile;
    const requestDataOwnerId = actorProfile.ownerId || authenticatedUserUid;

    if (itemOwnerId !== requestDataOwnerId) {
        return { authorized: false, error: 'Forbidden: Follow-up does not belong to your data scope.', status: 403 };
    }

    if (authenticatedUserUid === requestDataOwnerId) {
        return { authorized: true, followUpData, dataOwnerId: requestDataOwnerId, actorProfile };
    }

    const teamMemberDocRef = adminDb.collection('users').doc(requestDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if(teamMemberData.permissions?.canManageOrganizations) {
          return { authorized: true, followUpData, dataOwnerId: requestDataOwnerId, actorProfile };
        }
    }
    return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { followUpId: string } }) {
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const authResult = await authorizeAccess(params.followUpId, decodedToken.uid);
        if (!authResult.authorized || !authResult.followUpData) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        return NextResponse.json(authResult.followUpData, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { followUpId: string } }) {
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        
        const authResult = await authorizeAccess(params.followUpId, decodedToken.uid);
        if (!authResult.authorized || !authResult.followUpData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        const { actorProfile, dataOwnerId } = authResult;

        const requestBody = await request.json();
        const validationResult = followUpUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
        
        const dataFromClient = validationResult.data;

        const dataToUpdate: Partial<FollowUp> = {
            ...dataFromClient,
            updatedAt: new Date().toISOString(),
            updatedBy: decodedToken.uid,
            updatedByName: actorProfile.fullName || actorProfile.email || 'User'
        };
        
        if (dataFromClient.visitDate) dataToUpdate.visitDate = format(new Date(dataFromClient.visitDate), 'yyyy-MM-dd');
        if (dataFromClient.reminderDate) dataToUpdate.reminderDate = format(new Date(dataFromClient.reminderDate), 'yyyy-MM-dd');

        if (dataFromClient.organizationId && dataFromClient.organizationId !== authResult.followUpData.organizationId) {
            const orgRef = adminDb.collection('organizations').doc(dataFromClient.organizationId);
            const orgSnap = await orgRef.get();
            if (orgSnap.exists && (orgSnap.data()?.userId === dataOwnerId || orgSnap.data()?.visibility === 'public')) {
                dataToUpdate.organizationName = (orgSnap.data() as Organization).name;
            } else {
                dataToUpdate.organizationId = authResult.followUpData.organizationId;
                dataToUpdate.organizationName = authResult.followUpData.organizationName;
            }
        }
        
        await adminDb.collection('followUps').doc(params.followUpId).update(dataToUpdate);

        await logActivity({
            ownerId: dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: actorProfile.fullName || actorProfile.email || 'User',
            actionType: 'update',
            entityType: 'FollowUp',
            entityId: params.followUpId,
            entityName: `Follow-up for ${dataToUpdate.organizationName || authResult.followUpData.organizationName}`,
            details: 'Follow-up details updated.'
        });

        const updatedDoc = await adminDb.collection('followUps').doc(params.followUpId).get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { followUpId: string } }) {
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        
        const authResult = await authorizeAccess(params.followUpId, decodedToken.uid);
        if (!authResult.authorized || !authResult.followUpData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        const { actorProfile, dataOwnerId, followUpData } = authResult;

        await adminDb.collection('followUps').doc(params.followUpId).delete();

        await logActivity({
            ownerId: dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: actorProfile.fullName || actorProfile.email || 'User',
            actionType: 'delete',
            entityType: 'FollowUp',
            entityId: params.followUpId,
            entityName: `Follow-up for ${followUpData.organizationName}`,
            details: 'Follow-up record deleted.'
        });
        return NextResponse.json({ message: 'Follow-up deleted successfully' }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
