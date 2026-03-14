

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { License, Company, UserProfile, TeamMember, AppConfiguration } from '@/types';
import { LICENSE_TYPES_OPTIONS } from '@/types/server-only';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { LICENSE_CREATION_COST } from '@/lib/constants';
import { format as formatTZ } from 'date-fns-tz';
import { parseISO } from 'date-fns';
export const dynamic = 'force-dynamic';
// Validation schema for creating a license
const licenseFormSchema = z.object({
  licenseName: z.string().min(1, "License name is required.").max(255),
  licenseNumber: z.string().min(1, "License number is required.").max(100),
  licenseType: z.string().refine(val => LICENSE_TYPES_OPTIONS.includes(val as typeof LICENSE_TYPES_OPTIONS[number]), { message: "Invalid license type." }),
  issuingAuthority: z.string().min(1, "Issuing authority is required.").max(255),
  issueDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid issue date." }),
  expiryDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid expiry date." }),
  companyId: z.string().optional().nullable(),
  documentUrl: z.string().max(3 * 1024 * 1024, "Document URL/data too large. Max 3MB.").optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  dataOwnerId: z.string().min(1, "Data owner context is required."), // Explicitly require data context
}).refine(data => new Date(data.expiryDate) >= new Date(data.issueDate), {
  message: "Expiry date cannot be before issue date.",
  path: ["expiryDate"],
});

// Helper function for authorization check
async function authorizeAccess(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === requestedDataOwnerId) {
    return true;
  }
  const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (memberProfileDoc.exists) {
    const memberProfile = memberProfileDoc.data() as UserProfile;
    if (memberProfile.ownerId === requestedDataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        return (teamMemberDocSnap.data() as TeamMember).permissions?.canManageOwnerLicenses || false;
      }
    }
  }
  return false;
}

// GET handler
export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    if (!requestedDataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const hasPermission = await authorizeAccess(authenticatedUserUid, requestedDataOwnerId);
    if (!hasPermission) {
        return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });
    }

    const licensesSnapshot = await adminDb.collection('licenses')
      .where('userId', '==', requestedDataOwnerId)
      .orderBy('expiryDate', 'asc')
      .get();
    const licenses: License[] = licensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as License));
    return NextResponse.json(licenses, { status: 200 });

  } catch (error: any) {
    console.error('API /api/licenses GET error:', error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

// POST handler
export async function POST(request: Request) {
  const functionCallId = `api_licenses_POST_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = licenseFormSchema.safeParse(requestBody);
    if (!validationResult.success) {
        return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { dataOwnerId, ...dataFromClient } = validationResult.data;

    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!userProfileDoc.exists) return NextResponse.json({ error: 'User profile not found for authenticated user' }, { status: 403 });
    const userProfile = userProfileDoc.data() as UserProfile;
    
    // **CRITICAL FIX**: Use the `dataOwnerId` from the client request as the single source of truth for the context.
    const effectiveDataOwnerId = dataOwnerId;

    let canCreate = false;
    if (authenticatedUserUid === effectiveDataOwnerId) { // User is owner of the context
      canCreate = true;
    } else { // User might be a team member of the context
      const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if(memberProfileDoc.exists && (memberProfileDoc.data() as UserProfile).ownerId === effectiveDataOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(effectiveDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageOwnerLicenses) canCreate = true;
        }
      }
    }

    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden: No permission to create licenses for this account.' }, { status: 403 });
    }
    
    const pointPayerProfileRef = adminDb.collection('users').doc(effectiveDataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_LICENSE_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = LICENSE_CREATION_COST;

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "LICENSE_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /licenses POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const now = new Date().toISOString();
    
    let companyName: string | null = null;
    let companyId: string | null = dataFromClient.companyId || null;
    
    if (companyId) {
        const companyDocRef = adminDb.collection('companies').doc(companyId);
        const companySnap = await companyDocRef.get();
        if (companySnap.exists && companySnap.data()?.userId === effectiveDataOwnerId) {
            companyName = (companySnap.data() as Company).name;
        } else {
            console.warn(`License POST: Company ID ${companyId} provided but not found or not accessible to owner ${effectiveDataOwnerId}.`);
            companyId = null;
        }
    }

    const newLicenseData: Omit<License, 'id'> = {
      userId: effectiveDataOwnerId, // Use the server-determined owner ID
      createdByName: userProfile.fullName || userProfile.email || "User",
      licenseName: dataFromClient.licenseName,
      licenseNumber: dataFromClient.licenseNumber,
      licenseType: dataFromClient.licenseType,
      issuingAuthority: dataFromClient.issuingAuthority,
      issueDate: dataFromClient.issueDate,
      expiryDate: dataFromClient.expiryDate,
      companyId: companyId,
      companyName: companyName,
      documentUrl: dataFromClient.documentUrl || null,
      notes: dataFromClient.notes || null,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: userProfile.fullName || userProfile.email || "User",
    };

    const batch = adminDb.batch();
    const newLicenseRef = adminDb.collection('licenses').doc();
    batch.set(newLicenseRef, newLicenseData);

    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });
    
    await batch.commit();

    await logActivity({
      ownerId: effectiveDataOwnerId, actorUid: authenticatedUserUid, actorName: userProfile.fullName || userProfile.email || "User",
      actionType: 'create', entityType: 'License', entityId: newLicenseRef.id, entityName: newLicenseData.licenseName,
      details: { message: `License '${newLicenseData.licenseName}' added.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newLicenseRef.id, ...newLicenseData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/licenses POST error:', error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
    
    
