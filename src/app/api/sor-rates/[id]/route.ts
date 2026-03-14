

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { SorRate, Organization, UserProfile, TeamMember } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const sorRateUpdateSchema = z.object({
  itemCode: z.string().min(1, "Item code is required.").max(50).optional(),
  itemDescription: z.string().min(1, "Description is required.").max(500).optional(),
  unit: z.string().min(1, "Unit is required.").max(20).optional(),
  rate: z.coerce.number().min(0, "Rate must be non-negative.").optional(),
  organizationId: z.string().optional().nullable(),
  visibility: z.enum(['public', 'private']).optional(),
}).partial();


async function authorizeAccess(
  itemId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; sorRateData?: SorRate; dataOwnerId?: string; error?: string; status?: number }> {
  const itemDocRef = adminDb.collection('sorRates').doc(itemId);
  const itemSnap = await itemDocRef.get();
  if (!itemSnap.exists) return { authorized: false, error: 'SOR Item not found', status: 404 };
  
  const sorRateData = { id: itemSnap.id, ...itemSnap.data() } as SorRate;
  
  const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!userProfileDoc.exists) return { authorized: false, error: 'User profile not found', status: 403 };
  const userProfile = userProfileDoc.data() as UserProfile;
  const requestDataOwnerId = userProfile.ownerId || authenticatedUserUid;

  if (sorRateData.userId !== requestDataOwnerId) return { authorized: false, error: 'Forbidden: Item does not belong to your data scope.', status: 403 };

  if (authenticatedUserUid === requestDataOwnerId) return { authorized: true, sorRateData, dataOwnerId: requestDataOwnerId };

  const teamMemberDocRef = adminDb.collection('users').doc(requestDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
  const teamMemberDocSnap = await teamMemberDocRef.get();
  if (teamMemberDocSnap.exists) {
    const teamMemberData = teamMemberDocSnap.data() as TeamMember;
    if (teamMemberData.permissions?.canManageOwnerSORs) return { authorized: true, sorRateData, dataOwnerId: requestDataOwnerId };
  }
  return { authorized: false, error: 'Forbidden: You do not have permission.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const itemId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;
        
        // For GET, we allow a broader access check
        const itemDocRef = await adminDb.collection('sorRates').doc(itemId).get();
        if(!itemDocRef.exists) return NextResponse.json({ error: "SOR Rate not found" }, { status: 404 });
        
        const sorRateData = { id: itemDocRef.id, ...itemDocRef.data() } as SorRate;
        const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
        if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: User profile not found' }, { status: 403 });
        const authUserProfile = authUserProfileDoc.data() as UserProfile;

        const canView = (sorRateData.visibility === 'public') || (sorRateData.userId === (authUserProfile.ownerId || authenticatedUserUid));

        if (canView) {
            return NextResponse.json(sorRateData, { status: 200 });
        }
        return NextResponse.json({ error: 'Forbidden: Not authorized to view this SOR item' }, { status: 403 });

    } catch (error: any) {
        console.error(`API /api/sor-rates/[${itemId}] GET error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const itemId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const authResult = await authorizeAccess(itemId, authenticatedUserUid);
    if (!authResult.authorized || !authResult.sorRateData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const requestBody = await request.json();
    const validationResult = sorRateUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;

    const dataToUpdate: Partial<SorRate> = { ...dataFromClient };

    if (dataFromClient.organizationId) {
        const orgDoc = await adminDb.collection('organizations').doc(dataFromClient.organizationId).get();
        if (orgDoc.exists) dataToUpdate.organizationName = (orgDoc.data() as Organization).name;
    } else {
        dataToUpdate.organizationName = null;
    }
    
    dataToUpdate.updatedAt = new Date().toISOString();
    dataToUpdate.updatedBy = decodedToken.uid;
    dataToUpdate.updatedByName = userProfile.fullName || userProfile.email || "User";

    const cleanedData: { [key: string]: any } = {};
    for (const key in dataToUpdate) {
        if (dataToUpdate[key as keyof typeof dataToUpdate] !== undefined) {
            cleanedData[key] = dataToUpdate[key as keyof typeof dataToUpdate];
        }
    }
    
    const itemDocRef = adminDb.collection('sorRates').doc(itemId);
    await itemDocRef.update(cleanedData);

    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'update', entityType: 'SorRate', entityId: itemId, entityName: dataToUpdate.itemCode || authResult.sorRateData.itemCode,
        details: `SOR Item '${dataToUpdate.itemCode || authResult.sorRateData.itemCode}' updated.`
    });

    const updatedDoc = await itemDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/sor-rates/[${itemId}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const itemId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;

    const authResult = await authorizeAccess(itemId, decodedToken.uid);
    if (!authResult.authorized || !authResult.sorRateData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });

    await adminDb.collection('sorRates').doc(itemId).delete();
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'delete', entityType: 'SorRate', entityId: itemId, entityName: authResult.sorRateData.itemCode,
        details: `SOR Item '${authResult.sorRateData.itemCode}' deleted.`
    });
    return NextResponse.json({ message: 'SOR item deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/sor-rates/[${itemId}] DELETE error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
