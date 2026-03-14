import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Company, UserProfile, TeamMember, AppConfiguration } from '@/types/server-only';
import { z } from 'zod';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { COMPANY_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const companyCreateSchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }).max(100),
  companyType: z.string().max(100).optional().nullable(),
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
  address: z.string().min(5, { message: "Address must be at least 5 characters." }).max(300),
  website: z.string().url({ message: "Please enter a valid URL." }).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().nullable(),
  contactPhone: z.string()
    .refine(val => val === '' || val === null || /^\+?[0-9\s-()]{7,20}$/.test(val), {
      message: "Invalid phone number format.",
    })
    .optional().nullable(),
  role: z.string().max(50).optional().nullable(),
  dataOwnerId: z.string().min(1),
});

export async function GET(request: Request) {
  const functionCallId = `api_companies_GET_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  
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
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error:any) {
      console.error('Token verification error in /api/companies GET:', error.code, error.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;
    
    let canAccess = false;
    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;

    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true;
    } else if (authUserProfile.ownerId === requestedDataOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
          const teamMemberData = teamMemberDocSnap.data() as TeamMember;
          if (teamMemberData.permissions?.canManageCompanies || teamMemberData.permissions?.canCreateEstimates || teamMemberData.permissions?.canCreateWorkOrders) {
            canAccess = true;
          }
        }
    }


    if (!canAccess) {
      console.warn(`[${functionCallId}] Forbidden access attempt. User ${authenticatedUserUid} tried to access companies for ${requestedDataOwnerId}.`);
      return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });
    }

    const companiesSnapshot = await adminDb.collection('companies')
      .where('userId', '==', requestedDataOwnerId)
      .orderBy('name', 'asc')
      .get();
      
    if (companiesSnapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const companies: Company[] = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
    
    return NextResponse.json(companies, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/companies GET handler:`, error);
    const errorMessageText = (error as any).message || '';
    const isMissingIndexError = (error as any).code === 5 && (errorMessageText.includes('query requires an index') || errorMessageText.includes('requires an index'));

    if (isMissingIndexError) {
        const detailedErrorMessage = "A Firestore index is required for this query. Please check your server logs for a link to create the necessary index. The query is likely on the 'companies' collection, filtering by 'userId'.";
        console.error(`[${functionCallId}] Firestore 'FAILED_PRECONDITION' or missing index error detected. Original error: ${errorMessageText}`);
        return NextResponse.json({ error: 'Database Index Required', details: detailedErrorMessage, code: 'FAILED_PRECONDITION' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error', details: errorMessageText, code: (error as any).code || 'UNKNOWN_SERVER_ERROR_COMPANIES_GET' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const functionCallId = `api_companies_POST_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await authAdmin.verifyIdToken(idToken); } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = companyCreateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { dataOwnerId, ...companyDataFromClient } = validationResult.data;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'User profile not found for authenticated user' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) {
      canCreate = true;
    } else if (authUserProfile.ownerId === dataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageCompanies) canCreate = true;
      }
    }
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create companies.' }, { status: 403 });
    }
    
    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_COMPANY_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = COMPANY_CREATION_COST;

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "COMPANY_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /companies POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    const now = new Date().toISOString();
    const newCompanyData: Omit<Company, 'id'> = {
      userId: dataOwnerId, 
      createdByName: authUserProfile.fullName || authUserProfile.email || "User",
      name: companyDataFromClient.name,
      address: companyDataFromClient.address,
      companyType: companyDataFromClient.companyType || null,
      description: companyDataFromClient.description || null,
      logoUrl: companyDataFromClient.logoUrl || null,
      gstin: companyDataFromClient.gstin || null,
      panNumber: companyDataFromClient.panNumber || null,
      registrationNumber: companyDataFromClient.registrationNumber || null,
      establishedYear: companyDataFromClient.establishedYear ?? null,
      website: companyDataFromClient.website || null,
      contactPerson: companyDataFromClient.contactPerson || null,
      contactEmail: companyDataFromClient.contactEmail || null,
      contactPhone: companyDataFromClient.contactPhone || null,
      role: companyDataFromClient.role || null,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
    };

    const batch = adminDb.batch();
    const newCompanyRef = adminDb.collection('companies').doc();
    batch.set(newCompanyRef, newCompanyData);
    
    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });

    await batch.commit();

    const createdCompany = { id: newCompanyRef.id, ...newCompanyData };

    await logActivity({
      ownerId: dataOwnerId,
      actorUid: authenticatedUserUid,
      actorName: authUserProfile.fullName || authUserProfile.email || "User",
      actionType: 'create',
      entityType: 'Company',
      entityId: newCompanyRef.id,
      entityName: createdCompany.name,
      details: {
          message: `Company profile '${createdCompany.name}' created.`,
          cost: actualCost
      }
    });

    return NextResponse.json({ ...createdCompany, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/companies POST handler:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: (error as any).code || 'UNKNOWN_SERVER_ERROR_COMPANIES_POST' }, { status: 500 });
  }
}
