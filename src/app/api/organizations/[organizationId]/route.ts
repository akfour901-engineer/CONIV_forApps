
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Organization, UserProfile, TeamMember, OrganizationStatusType, LeadSourceType } from '@/types';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog'; // Added import
import { ORGANIZATION_STATUS_OPTIONS, LEAD_SOURCE_OPTIONS } from '@/types';
export const dynamic = 'force-dynamic';
const organizationUpdateSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters.").max(100).optional(),
  type: z.string().max(100).optional().or(z.literal('')).nullable(),
  address: z.string().max(300).optional().or(z.literal('')).nullable(),
  city: z.string().max(100).optional().or(z.literal('')).nullable(),
  state: z.string().max(100).optional().or(z.literal('')).nullable(),
  pincode: z.string().refine(val => val === '' || val === null || /^\d{6}$/.test(val), { message: "Pincode must be 6 digits if provided." }).optional().or(z.literal('')).nullable(),
  gstin: z.string().refine(val => val === '' || val === null || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), { message: "GSTIN must be valid." }).optional().or(z.literal('')).nullable(),
  contactPerson: z.string().max(100).optional().or(z.literal('')).nullable(),
  contactEmail: z.string().email().optional().or(z.literal('')).nullable(),
  contactPhone: z.string().refine(val => val === '' || val === null || /^\+?[0-9\s-()]{7,20}$/.test(val), { message: "Invalid phone." }).optional().or(z.literal('')).nullable(),
  visibility: z.enum(['public', 'private']).optional(),
  organizationStatus: z.enum(ORGANIZATION_STATUS_OPTIONS).optional().nullable(),
  leadSource: z.enum(LEAD_SOURCE_OPTIONS).optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
}).partial();

async function authorizeAccessAndGetOrg(
    organizationId: string, 
    authenticatedUserUid: string, 
    adminDb: admin.firestore.Firestore,
    requiredPermissionKey: keyof TeamMember['permissions'] | 'view_public_or_own' // Special key for GET
): Promise<{ authorized: boolean; orgData?: Organization; dataOwnerId?: string; error?: string; status?: number }> {
  
  const orgDocRef = adminDb.collection('organizations').doc(organizationId);
  const orgSnap = await orgDocRef.get();

  if (!orgSnap.exists) {
    return { authorized: false, error: 'Organization not found', status: 404 };
  }
  const orgData = { id: orgSnap.id, ...orgSnap.data() } as Organization;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
  const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  const dataOwnerIdForRequest = authUserProfile.ownerId || authenticatedUserUid;

  // For GET, allow if public OR if user owns it OR if user is team member with view permission
  if (requiredPermissionKey === 'view_public_or_own') {
    if (orgData.visibility === 'public') return { authorized: true, orgData, dataOwnerId: orgData.userId };
    if (orgData.userId === dataOwnerIdForRequest) { // User owns this (or is owner of team accessing it)
      if (authenticatedUserUid === dataOwnerIdForRequest) return { authorized: true, orgData, dataOwnerId: dataOwnerIdForRequest }; // Owner accessing
      // Team member accessing owner's private org
      const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerIdForRequest).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageOrganizations) return { authorized: true, orgData, dataOwnerId: dataOwnerIdForRequest };
      }
    }
    return { authorized: false, error: 'Forbidden: Private organization not accessible.', status: 403 };
  }

  // For PUT/DELETE, only owner or team member with specific permission can modify their own data scope's orgs
  if (orgData.userId !== dataOwnerIdForRequest) return { authorized: false, error: 'Forbidden: Organization does not belong to your data scope.', status: 403 };
  
  if (authenticatedUserUid === dataOwnerIdForRequest) return { authorized: true, orgData, dataOwnerId: dataOwnerIdForRequest }; // Owner
  
  if (requiredPermissionKey && authUserProfile.ownerId) { // Team member
    const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerIdForRequest).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.[requiredPermissionKey as keyof TeamMember['permissions']]) return { authorized: true, orgData, dataOwnerId: dataOwnerIdForRequest };
    }
  }
  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { organizationId: string } }) {
  const organizationId = params.organizationId;

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authResult = await authorizeAccessAndGetOrg(organizationId, decodedToken.uid, adminDb, 'view_public_or_own');
    if (!authResult.authorized || !authResult.orgData) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    return NextResponse.json(authResult.orgData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/organizations/[${organizationId}] GET error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { organizationId: string } }) {
  const organizationId = params.organizationId;

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;

    const authResult = await authorizeAccessAndGetOrg(organizationId, authenticatedUserUid, adminDb, 'canManageOrganizations');
    if (!authResult.authorized || !authResult.orgData || !authResult.dataOwnerId) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    // Additional check: ensure user is editing an org they own or manage via their team owner, not a public one they don't own.
    if (authResult.orgData.visibility === 'public' && authResult.orgData.userId !== authResult.dataOwnerId) {
        return NextResponse.json({ error: 'Forbidden: You cannot edit a public organization you do not own.' }, { status: 403 });
    }
    
    const requestBody = await request.json();
    const validationResult = organizationUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const orgDataFromClient = validationResult.data;

    // Server-side check to prevent public orgs from becoming private
    if (authResult.orgData.visibility === 'public' && orgDataFromClient.visibility === 'private') {
        return NextResponse.json({ error: 'A public organization cannot be made private.' }, { status: 400 });
    }


    const now = new Date().toISOString();
    const dataToUpdate: Partial<Organization> & {[key: string]: any} = {
      ...orgDataFromClient,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
    };
    
    Object.keys(dataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof dataToUpdate;
        if (dataToUpdate[typedKey] === "") dataToUpdate[typedKey] = null; // Convert empty strings to null for Firestore
        else if (dataToUpdate[typedKey] === undefined) delete dataToUpdate[typedKey];
    });


    const orgDocRef = adminDb.collection('organizations').doc(organizationId);
    await orgDocRef.update(dataToUpdate);

    await logActivity({
        ownerId: authResult.dataOwnerId,
        actorUid: authenticatedUserUid,
        actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'update',
        entityType: 'Organization',
        entityId: organizationId,
        entityName: dataToUpdate.name || authResult.orgData.name,
        details: `Organization '${dataToUpdate.name || authResult.orgData.name}' updated.`
    });


    const updatedDoc = await orgDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/organizations/[${organizationId}] PUT error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { organizationId: string } }) {
  const organizationId = params.organizationId;

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;


    const authResult = await authorizeAccessAndGetOrg(organizationId, authenticatedUserUid, adminDb, 'canManageOrganizations'); // Requires manage permission for delete
    if (!authResult.authorized || !authResult.orgData || !authResult.dataOwnerId) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    // Ensure user is deleting an org they own or manage via their team owner, not a public one they don't own.
    if (authResult.orgData.userId !== authResult.dataOwnerId) {
        return NextResponse.json({ error: 'Forbidden: You can only delete organizations within your direct data scope.' }, { status: 403 });
    }

    const estimatesExist = !(await adminDb.collection('estimates').where('organizationId', '==', organizationId).where('userId', '==', authResult.dataOwnerId).limit(1).get()).empty;
    const workOrdersExist = !(await adminDb.collection('workOrders').where('organizationId', '==', organizationId).where('userId', '==', authResult.dataOwnerId).limit(1).get()).empty;
    const invoicesExist = !(await adminDb.collection('invoices').where('organizationId', '==', organizationId).where('userId', '==', authResult.dataOwnerId).limit(1).get()).empty;

    if (estimatesExist || workOrdersExist || invoicesExist) {
      return NextResponse.json({ 
        error: 'Cannot delete organization: It is linked to existing estimates, work orders, or invoices. Please remove these associations first.',
        code: 'ORGANIZATION_HAS_DEPENDENCIES'
      }, { status: 409 }); 
    }

    await adminDb.collection('organizations').doc(organizationId).delete();
    
    await logActivity({
        ownerId: authResult.dataOwnerId,
        actorUid: authenticatedUserUid,
        actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'delete',
        entityType: 'Organization',
        entityId: organizationId,
        entityName: authResult.orgData.name,
        details: `Organization '${authResult.orgData.name}' deleted.`
    });

    return NextResponse.json({ message: 'Organization deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/organizations/[${organizationId}] DELETE error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

    