


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { License, Company, UserProfile, TeamMember } from '@/types';
import { LICENSE_TYPES_OPTIONS } from '@/types/server-only';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { format as formatTZ } from 'date-fns-tz';
import { parseISO } from 'date-fns';
export const dynamic = 'force-dynamic';
const licenseUpdateSchema = z.object({
  licenseName: z.string().min(1, "License name is required.").max(255).optional(),
  licenseNumber: z.string().min(1, "License number is required.").max(100).optional(),
  licenseType: z.string().refine(val => LICENSE_TYPES_OPTIONS.includes(val as typeof LICENSE_TYPES_OPTIONS[number]), { message: "Invalid license type." }).optional(),
  issuingAuthority: z.string().min(1, "Issuing authority is required.").max(255).optional(),
  issueDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid issue date." }).optional(),
  expiryDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid expiry date." }).optional(),
  companyId: z.string().optional().nullable(),
  documentUrl: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).partial().refine(data => !data.expiryDate || !data.issueDate || new Date(data.expiryDate) >= new Date(data.issueDate), {
  message: "Expiry date cannot be before issue date if both are provided.",
  path: ["expiryDate"],
});

async function authorizeAccess(
  licenseId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; licenseData?: License; dataOwnerId?: string; error?: string; status?: number }> {
  const licenseDocRef = adminDb.collection('licenses').doc(licenseId);
  const licenseSnap = await licenseDocRef.get();
  if (!licenseSnap.exists) return { authorized: false, error: 'License not found', status: 404 };
  
  const licenseData = { id: licenseSnap.id, ...licenseSnap.data() } as License;
  const itemOwnerId = licenseData.userId;

  // Case 1: The authenticated user is the direct owner of the license.
  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, licenseData, dataOwnerId: itemOwnerId };
  }
  
  // Case 2: The authenticated user is a team member. Check if they belong to the item's owner.
  const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!userProfileDoc.exists) return { authorized: false, error: 'User profile not found', status: 403 };
  const userProfile = userProfileDoc.data() as UserProfile;

  if (userProfile.ownerId === itemOwnerId) {
    // This user is a member of the team that owns the license. Now check for permissions.
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageOwnerLicenses) {
            return { authorized: true, licenseData, dataOwnerId: itemOwnerId };
        }
    }
  }

  // If neither of the above conditions are met, access is denied.
  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const licenseId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authResult = await authorizeAccess(licenseId, decodedToken.uid);
    if (!authResult.authorized || !authResult.licenseData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.licenseData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/licenses/[${licenseId}] GET error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const licenseId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authResult = await authorizeAccess(licenseId, decodedToken.uid);
    if (!authResult.authorized || !authResult.licenseData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const requestBody = await request.json();
    const validationResult = licenseUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;

    const dataToUpdate: Partial<License> = { ...dataFromClient };
    if (dataFromClient.issueDate) dataToUpdate.issueDate = dataFromClient.issueDate;
    if (dataFromClient.expiryDate) dataToUpdate.expiryDate = dataFromClient.expiryDate;
    
    if (dataFromClient.companyId !== undefined) {
        dataToUpdate.companyId = dataFromClient.companyId;
        if (dataFromClient.companyId) {
            const companyDocRef = adminDb.collection('companies').doc(dataFromClient.companyId);
            const companySnap = await companyDocRef.get();
            if (companySnap.exists && companySnap.data()?.userId === authResult.dataOwnerId) {
                dataToUpdate.companyName = (companySnap.data() as Company).name;
            } else {
                dataToUpdate.companyName = null;
            }
        } else {
            dataToUpdate.companyName = null;
        }
    }
    
    dataToUpdate.updatedAt = new Date().toISOString();
    dataToUpdate.updatedBy = decodedToken.uid;
    dataToUpdate.updatedByName = userProfile.fullName || userProfile.email || "User";

    const cleanedDataToUpdate: { [key: string]: any } = {};
    for (const key in dataToUpdate) {
      const typedKey = key as keyof typeof dataToUpdate;
      if (dataToUpdate[typedKey] !== undefined) {
        // This includes null, which is a valid value for clearing a field
        cleanedDataToUpdate[typedKey] = dataToUpdate[typedKey];
      }
    }

    const licenseDocRef = adminDb.collection('licenses').doc(licenseId);
    await licenseDocRef.update(cleanedDataToUpdate);

    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'update', entityType: 'License', entityId: licenseId, entityName: dataToUpdate.licenseName || authResult.licenseData.licenseName,
        details: `License '${dataToUpdate.licenseName || authResult.licenseData.licenseName}' updated.`
    });

    const updatedDoc = await licenseDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/licenses/[${licenseId}] PUT error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const licenseId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;

    const authResult = await authorizeAccess(licenseId, decodedToken.uid);
    if (!authResult.authorized || !authResult.licenseData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });

    await adminDb.collection('licenses').doc(licenseId).delete();
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: decodedToken.uid, actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'delete', entityType: 'License', entityId: licenseId, entityName: authResult.licenseData.licenseName,
        details: `License '${authResult.licenseData.licenseName}' deleted.`
    });
    return NextResponse.json({ message: 'License deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/licenses/[${licenseId}] DELETE error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
    

    
