

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Company, UserProfile, TeamMember } from '@/types/server-only';
import { z } from 'zod';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const companyUpdateSchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }).max(100).optional(),
  companyType: z.string().max(100).optional().or(z.literal('')).nullable(),
  description: z.string().max(500).optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  gstin: z.string()
    .refine(val => val === null || val === '' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), {
      message: "GSTIN must be a valid 15-character format if provided.",
    })
    .optional().nullable(),
  panNumber: z.string()
    .refine(val => val === null || val === '' || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val), {
      message: "PAN must be a valid 10-character format if provided.",
    })
    .optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  establishedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  address: z.string().min(5, { message: "Address must be at least 5 characters." }).max(300).optional(),
  website: z.string().url({ message: "Please enter a valid URL." }).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().nullable(),
  contactPhone: z.string()
    .refine(val => val === null || val === '' || /^\+?[0-9\s-()]{7,20}$/.test(val), {
      message: "Invalid phone number format.",
    })
    .optional().nullable(),
  role: z.string().max(50).optional().nullable(),
}).partial(); 

async function authorizeAccessAndGetCompany(
    companyId: string, 
    authenticatedUserUid: string, 
    adminDb: admin.firestore.Firestore,
    requiredPermissionKey: keyof TeamMember['permissions'] | null // e.g., 'canManageCompanies'
): Promise<{ authorized: boolean; companyData?: Company; dataOwnerId?: string; error?: string; status?: number }> {
  const companyDocRef = adminDb.collection('companies').doc(companyId);
  const companySnap = await companyDocRef.get();
  if (!companySnap.exists) return { authorized: false, error: 'Company not found', status: 404 };
  const companyData = { id: companySnap.id, ...companySnap.data() } as Company;
  const itemOwnerId = companyData.userId; // This is the actual owner of the company document

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
  const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  
  // User is the direct owner of the item
  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, companyData, dataOwnerId: itemOwnerId };
  }

  // User is a team member, check if their ownerId matches the itemOwnerId
  if (authUserProfile.ownerId === itemOwnerId) {
    if (!requiredPermissionKey) return { authorized: true, companyData, dataOwnerId: itemOwnerId }; // No specific permission, just needs to be member
    
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.[requiredPermissionKey as keyof TeamMember['permissions']]) {
        return { authorized: true, companyData, dataOwnerId: itemOwnerId };
      }
    }
  }
  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { companyId: string } }) {
    const { companyId } = params;
  const functionCallId = `api_company_GET_single_${Date.now()}`;
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);

    // For GET (view), canManageCompanies is a suitable permission.
    const authResult = await authorizeAccessAndGetCompany(companyId, decodedToken.uid, getDb(), 'canManageCompanies');
    if (!authResult.authorized || !authResult.companyData) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    return NextResponse.json(authResult.companyData, { status: 200 });
  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/companies/[${companyId}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { companyId: string } }) {
    const { companyId } = params;
  const functionCallId = `api_company_PUT_${Date.now()}`;
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const authUserProfileDoc = await getDb().collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;

    const authResult = await authorizeAccessAndGetCompany(companyId, authenticatedUserUid, getDb(), 'canManageCompanies');
    if (!authResult.authorized || !authResult.companyData || !authResult.dataOwnerId) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    const requestBody = await request.json();
    const validationResult = companyUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const companyDataFromClient = validationResult.data;

    const now = new Date().toISOString();
    const dataToUpdate: Partial<Company> & {[key: string]: any} = {
      ...companyDataFromClient,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
    };
    
    Object.keys(dataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof dataToUpdate;
        if (dataToUpdate[typedKey] === "") dataToUpdate[typedKey] = null; // Convert empty strings to null for Firestore
        else if (dataToUpdate[typedKey] === undefined) delete dataToUpdate[typedKey];
    });


    const companyDocRef = getDb().collection('companies').doc(companyId);
    await companyDocRef.update(dataToUpdate);

    await logActivity({
      ownerId: authResult.dataOwnerId, // Log against the actual owner of the company
      actorUid: authenticatedUserUid,
      actorName: authUserProfile.fullName || authUserProfile.email || "User",
      actionType: 'update',
      entityType: 'Company',
      entityId: companyId,
      entityName: dataToUpdate.name || authResult.companyData.name,
      details: `Company profile '${dataToUpdate.name || authResult.companyData.name}' updated.`
    });

    const updatedDoc = await companyDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/companies/[${companyId}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { companyId: string } }) {
    const { companyId } = params;
  const functionCallId = `api_company_DELETE_${Date.now()}`;

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const authUserProfileDoc = await getDb().collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;

    const authResult = await authorizeAccessAndGetCompany(companyId, authenticatedUserUid, getDb(), 'canManageCompanies');
    if (!authResult.authorized || !authResult.companyData || !authResult.dataOwnerId) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }

    const itemOwnerId = authResult.dataOwnerId; // Use the actual owner ID of the company
    
    const estimatesExist = !(await getDb().collection('estimates').where('companyId', '==', companyId).where('userId', '==', itemOwnerId).limit(1).get()).empty;
    const workOrdersExist = !(await getDb().collection('workOrders').where('companyId', '==', companyId).where('userId', '==', itemOwnerId).limit(1).get()).empty;
    const invoicesExist = !(await getDb().collection('invoices').where('companyId', '==', companyId).where('userId', '==', itemOwnerId).limit(1).get()).empty;
    const licensesExist = !(await getDb().collection('licenses').where('companyId', '==', companyId).where('userId', '==', itemOwnerId).limit(1).get()).empty;

    if (estimatesExist || workOrdersExist || invoicesExist || licensesExist) {
      return NextResponse.json({ 
        error: 'Cannot delete company: It is linked to existing records (estimates, work orders, invoices, or licenses). Please remove these associations first.',
        code: 'COMPANY_HAS_DEPENDENCIES'
      }, { status: 409 });
    }

    await getDb().collection('companies').doc(companyId).delete();

    await logActivity({
      ownerId: itemOwnerId,
      actorUid: authenticatedUserUid,
      actorName: authUserProfile.fullName || authUserProfile.email || "User",
      actionType: 'delete',
      entityType: 'Company',
      entityId: companyId,
      entityName: authResult.companyData.name,
      details: `Company profile '${authResult.companyData.name}' deleted.`
    });

    return NextResponse.json({ message: 'Company deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/companies/[${companyId}] DELETE error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
