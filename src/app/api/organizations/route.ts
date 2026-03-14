


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Organization, UserProfile, TeamMember, AppConfiguration, OrganizationStatusType, LeadSourceType } from '@/types';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { ORGANIZATION_CREATION_COST } from '@/lib/constants';
import { ORGANIZATION_STATUS_OPTIONS, LEAD_SOURCE_OPTIONS } from '@/types';
export const dynamic = 'force-dynamic';
// ... (schema remains the same) ...
const organizationCreateSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters.").max(100),
  type: z.string().max(100).optional().nullable(),
  address: z.string().max(300).optional().or(z.literal('')).nullable(),
  city: z.string().max(100).optional().or(z.literal('')).nullable(),
  state: z.string().max(100).optional().or(z.literal('')).nullable(),
  pincode: z.string().refine(val => val === '' || val === null || /^\d{6}$/.test(val), { message: "Pincode must be 6 digits if provided." }).optional().or(z.literal('')).nullable(),
  gstin: z.string().refine(val => val === '' || val === null || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), { message: "GSTIN must be valid." }).optional().or(z.literal('')).nullable(),
  contactPerson: z.string().max(100).optional().or(z.literal('')).nullable(),
  contactEmail: z.string().email().optional().or(z.literal('')).nullable(),
  contactPhone: z.string().refine(val => val === '' || val === null || /^\+?[0-9\s-()]{7,20}$/.test(val), { message: "Invalid phone." }).optional().or(z.literal('')).nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
  organizationStatus: z.enum(ORGANIZATION_STATUS_OPTIONS).optional().nullable(),
  leadSource: z.enum(LEAD_SOURCE_OPTIONS).optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const functionCallId = `api_organizations_GET_${Date.now()}`;
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];

    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');

    if (!requestedDataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId query parameter is required' }, { status: 400 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error:any) {
      console.error('Token verification error in /api/organizations GET:', error.code, error.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;
    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) { 
      canAccess = true;
    } 
    else if (authUserProfile.ownerId === requestedDataOwnerId) { 
      const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        // A user needs to view companies if they can manage them, or if they can create estimates/WOs/etc.
        if (teamMemberData.permissions?.canManageOrganizations || teamMemberData.permissions?.canCreateEstimates || teamMemberData.permissions?.canCreateWorkOrders || teamMemberData.permissions?.canViewEstimates || teamMemberData.permissions?.canViewWorkOrders) {
          canAccess = true; 
        }
      }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    const userOrgsSnapshot = await adminDb.collection('organizations')
      .where('userId', '==', requestedDataOwnerId)
      .get();

    const organizationsMap = new Map<string, Organization>();
    userOrgsSnapshot.docs.forEach(doc => {
        organizationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Organization);
    });

    const publicOrgsSnapshot = await adminDb.collection('organizations')
        .where('visibility', '==', 'public')
        .get();

    publicOrgsSnapshot.docs.forEach(doc => {
        if (!organizationsMap.has(doc.id)) { 
            organizationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Organization);
        }
    });

    const organizationsArray = Array.from(organizationsMap.values());

    return NextResponse.json(organizationsArray, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/organizations GET handler:`, error);
    const errorMessageText = (error as any).message || '';
    const isMissingIndexError = (error as any).code === 'failed-precondition' || ((error as any).code === 5 && (errorMessageText.toLowerCase().includes('query requires an index')));
    
    if (isMissingIndexError) {
        const detailedErrorMessage = "A Firestore index is required for this query. Please check your server logs for a link to create the necessary index. The query is likely on the 'organizations' collection.";
        console.error(`[${functionCallId}] Firestore 'FAILED_PRECONDITION' or missing index error detected. Original error: ${errorMessageText}`);
        return NextResponse.json({ error: 'Database Index Required', details: detailedErrorMessage, code: 'FIRESTORE_INDEX_REQUIRED' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error.', 
      details: `An error occurred while querying the database. Code: ${(error as any).code || 'UNKNOWN_SERVER_ERROR_ORGS_GET'}. Message: ${errorMessageText}`, 
      code: (error as any).code || 'UNKNOWN_SERVER_ERROR_ORGS_GET' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await adminAuth.verifyIdToken(idToken); } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'User profile not found for authenticated user' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    const dataOwnerId = authUserProfile.ownerId || authenticatedUserUid; 

    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) { 
      canCreate = true;
    } else if (authUserProfile.ownerId) { 
      const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageOrganizations) canCreate = true;
      }
    }
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create organizations.' }, { status: 403 });
    }

    const requestBody = await request.json();
    const validationResult = organizationCreateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const orgDataFromClient = validationResult.data;

    // Check for duplicates before proceeding
    const existingOrgQuery = adminDb.collection('organizations')
        .where('userId', '==', dataOwnerId)
        .where('name', '==', orgDataFromClient.name);
    const existingOrgSnapshot = await existingOrgQuery.get();
    if (!existingOrgSnapshot.empty) {
        return NextResponse.json({ error: 'An organization with this name already exists.' }, { status: 409 });
    }


    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
      return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_ORG_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = ORGANIZATION_CREATION_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "ORGANIZATION_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`API /organizations POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    const now = new Date().toISOString();
    const newOrganizationData: Omit<Organization, 'id'> = {
      userId: dataOwnerId,
      createdByName: authUserProfile.fullName || authUserProfile.email || "User",
      name: orgDataFromClient.name,
      type: orgDataFromClient.type || null,
      address: orgDataFromClient.address || null,
      city: orgDataFromClient.city || null,
      state: orgDataFromClient.state || null,
      pincode: orgDataFromClient.pincode || null,
      gstin: orgDataFromClient.gstin || null,
      contactPerson: orgDataFromClient.contactPerson || null,
      contactEmail: orgDataFromClient.contactEmail || null,
      contactPhone: orgDataFromClient.contactPhone || null,
      visibility: orgDataFromClient.visibility,
      organizationStatus: orgDataFromClient.organizationStatus || null,
      leadSource: orgDataFromClient.leadSource || null,
      nextFollowUpDate: orgDataFromClient.nextFollowUpDate || null,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
    };

    const batch = adminDb.batch();
    const newOrgRef = adminDb.collection('organizations').doc();
    batch.set(newOrgRef, newOrganizationData);
    
    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });

    await batch.commit();

    const createdOrganization = { id: newOrgRef.id, ...newOrganizationData };
    
    await logActivity({
        ownerId: dataOwnerId,
        actorUid: authenticatedUserUid,
        actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'create',
        entityType: 'Organization',
        entityId: newOrgRef.id,
        entityName: createdOrganization.name,
        details: { message: `Organization '${createdOrganization.name}' created.`, cost: actualCost }
    });

    return NextResponse.json({ ...createdOrganization, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('Error in /api/organizations POST handler:', error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
