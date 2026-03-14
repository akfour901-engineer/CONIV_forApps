


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { Subcontractor, UserProfile, TeamMember } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const subcontractorUpdateSchema = z.object({
  name: z.string().min(2, "Name is required.").max(100).optional(),
  specialization: z.string().min(2, "Specialization is required.").max(100).optional(),
  contactPerson: z.string().max(100).optional().nullable(),
  email: z.string().email("Invalid email.").optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  rating: z.coerce.number().min(1).max(5).optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive', 'on_hold']).optional(),
}).partial();

async function authorizeAccess(
  subcontractorId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; subcontractorData?: Subcontractor; dataOwnerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
  
  const subcontractorDocRef = adminDb.collection('subcontractors').doc(subcontractorId);
  const subcontractorSnap = await subcontractorDocRef.get();
  if (!subcontractorSnap.exists) {
    return { authorized: false, error: 'Subcontractor not found', status: 404 };
  }
  const subcontractorData = { id: subcontractorSnap.id, ...subcontractorSnap.data() } as Subcontractor;
  const itemOwnerId = subcontractorData.userId;
  
  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) {
    return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
  }
  const actorProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  
  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, subcontractorData, dataOwnerId: itemOwnerId, actorProfile };
  }

  if (actorProfile.ownerId === itemOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.canManageSubcontractors) {
        return { authorized: true, subcontractorData, dataOwnerId: itemOwnerId, actorProfile };
      }
    }
  }
  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const subcontractorId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authResult = await authorizeAccess(subcontractorId, decodedToken.uid);
    if (!authResult.authorized || !authResult.subcontractorData) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    return NextResponse.json(authResult.subcontractorData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/subcontractors/[${subcontractorId}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const subcontractorId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const authResult = await authorizeAccess(subcontractorId, decodedToken.uid);
        if (!authResult.authorized || !authResult.subcontractorData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const requestBody = await request.json();
        const validationResult = subcontractorUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
        }
        
        const dataFromClient = validationResult.data;
        const actorProfile = authResult.actorProfile;

        const now = new Date().toISOString();
        const dataToUpdate: Partial<Subcontractor> & { updatedAt: string; updatedBy: string, updatedByName: string } = {
            ...dataFromClient,
            updatedAt: now,
            updatedBy: decodedToken.uid,
            updatedByName: actorProfile.fullName || actorProfile.email || "User",
        };

        const docRef = adminDb.collection('subcontractors').doc(subcontractorId);
        await docRef.update(dataToUpdate);
        
        console.log("LOGGING ACTIVITY FOR: Subcontractor Update");
        await logActivity({
            ownerId: authResult.dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: actorProfile.fullName || actorProfile.email || "User",
            actionType: 'update',
            entityType: 'Subcontractor',
            entityId: subcontractorId,
            entityName: dataToUpdate.name || authResult.subcontractorData.name,
            details: `Subcontractor profile updated.`
        });
        console.log("LOGGING COMPLETE FOR: Subcontractor Update");

        const updatedDoc = await docRef.get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (error: any) {
        console.error(`API /api/subcontractors/[${subcontractorId}] PUT error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const subcontractorId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const authResult = await authorizeAccess(subcontractorId, decodedToken.uid);
        if (!authResult.authorized || !authResult.subcontractorData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const linkedPoSnapshot = await adminDb.collection('purchaseOrders').where('supplierSubcontractorId', '==', subcontractorId).limit(1).get();
        if (!linkedPoSnapshot.empty) {
            return NextResponse.json({ error: "Cannot delete: Subcontractor is linked to one or more Purchase Orders." }, { status: 409 });
        }

        await adminDb.collection('subcontractors').doc(subcontractorId).delete();

        const actorProfile = authResult.actorProfile;
        
        console.log("LOGGING ACTIVITY FOR: Subcontractor Deletion");
        await logActivity({
            ownerId: authResult.dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: actorProfile.fullName || "User",
            actionType: 'delete',
            entityType: 'Subcontractor',
            entityId: subcontractorId,
            entityName: authResult.subcontractorData.name
        });
        console.log("LOGGING COMPLETE FOR: Subcontractor Deletion");
        
        return NextResponse.json({ message: 'Subcontractor deleted successfully.' }, { status: 200 });
    } catch (error: any) {
        console.error(`API /api/subcontractors/[${subcontractorId}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

  