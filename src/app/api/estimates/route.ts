
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { Estimate, EstimateItem, UserProfile, Company, Organization, TeamMember, AppConfiguration } from '@/types';
import { ESTIMATE_CREATION_COST } from '@/lib/constants';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const estimateItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().min(1, "Unit is required."),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
  amount: z.coerce.number().min(0),
});

const estimateCreateSchema = z.object({
  estimateNumber: z.string().min(1, "Estimate number is required."),
  subjectOfWork: z.string().max(500).optional().nullable(),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format for estimate date." }),
  validUntil: z.string().optional().nullable().refine(val => val === null || val === undefined || val === '' || !isNaN(Date.parse(val)), { message: "Invalid date format for valid until date." }),
  companyId: z.string().min(1, "Company ID is required."),
  organizationId: z.string().min(1, "Organization ID is required."),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'expired']).default('draft'),
  items: z.array(estimateItemSchema).min(1, "At least one item is required."),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  dataOwnerId: z.string().min(1), // Explicitly require data context
}).refine(data => data.validUntil === null || data.validUntil === undefined || data.validUntil === '' || new Date(data.validUntil) >= new Date(data.date), {
  message: "Valid until date cannot be before estimate date.",
  path: ["validUntil"],
});


export async function GET(request: Request) {
  const functionCallId = `api_estimates_GET_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const sort = url.searchParams.get('sort') || 'createdAt';
    const direction = url.searchParams.get('direction') || 'desc';
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');

    if (!requestedDataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) {
        canAccess = true;
    } else {
        const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
        if (authUserProfileDoc.exists && authUserProfileDoc.data()?.ownerId === requestedDataOwnerId) {
            const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if (teamMemberDocSnap.exists) {
                const teamMemberData = teamMemberDocSnap.data() as TeamMember;
                if (teamMemberData.permissions?.canViewEstimates) {
                    canAccess = true;
                }
            }
        }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    let estimatesQuery = adminDb.collection('estimates').where('userId', '==', requestedDataOwnerId);
    let totalQuery = adminDb.collection('estimates').where('userId', '==', requestedDataOwnerId);

    if(status && status !== 'all') {
        estimatesQuery = estimatesQuery.where('status', '==', status);
        totalQuery = totalQuery.where('status', '==', status);
    }
    
    // Note: Firestore does not support full-text search. This search implementation is basic.
    // A more advanced solution would use a third-party service like Algolia.
    // For now, we fetch and filter in-memory if a search term is provided.
    
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    const estimatesSnapshot = await estimatesQuery.orderBy(sort, direction as 'asc' | 'desc').limit(limit).offset((page - 1) * limit).get();
      
    const estimates: Estimate[] = estimatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estimate));
    
    // In-memory search if 'search' param is present
    if (search) {
      const searchTermLower = search.toLowerCase();
      const filteredEstimates = estimates.filter(est => 
        est.estimateNumber.toLowerCase().includes(searchTermLower) ||
        est.organizationName.toLowerCase().includes(searchTermLower) ||
        (est.companyName && est.companyName.toLowerCase().includes(searchTermLower))
      );
      return NextResponse.json({ estimates: filteredEstimates, total: filteredEstimates.length }, { status: 200 });
    }

    return NextResponse.json({ estimates, total }, { status: 200 });
  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/estimates GET error:`, error);
    const errorMessageText = error.message || 'An unspecified error occurred on the server.';
    const errorCode = error.code || 'UNKNOWN_SERVER_ERROR_ESTIMATES_GET';

    const isMissingIndexError = error.code === 'failed-precondition' || (error.code === 5 && (errorMessageText.toLowerCase().includes('query requires an index')));
    
    if (isMissingIndexError) {
        const detailedErrorMessage = "A Firestore index is required for this query. Please check your server logs for a link to create the necessary index.";
        console.error(`[${functionCallId}] Firestore 'FAILED_PRECONDITION' or missing index error detected. Original error: ${errorMessageText}`);
        return NextResponse.json({ error: 'Database Index Required', details: detailedErrorMessage, code: 'FIRESTORE_INDEX_REQUIRED' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error.', 
      details: `An error occurred while querying the database. Code: ${errorCode}. Message: ${errorMessageText}`, 
      code: errorCode 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = estimateCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...estimateDataFromClient } = validationResult.data;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) { 
      canCreate = true;
    } else if (authUserProfile.ownerId === dataOwnerId) { 
      const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canCreateEstimates) canCreate = true;
      }
    }
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create estimates for this account.' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = ESTIMATE_CREATION_COST;
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "ESTIMATE_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError) { console.warn("API /estimates POST: Error fetching app config for cost, using default:", configError); }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    const companyDoc = await adminDb.collection('companies').doc(estimateDataFromClient.companyId).get();
    if (!companyDoc.exists || companyDoc.data()?.userId !== dataOwnerId) return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 });
    const companyData = {id: companyDoc.id, ...companyDoc.data()} as Company;

    const organizationDoc = await adminDb.collection('organizations').doc(estimateDataFromClient.organizationId).get();
    if (!organizationDoc.exists || (organizationDoc.data()?.visibility !== 'public' && organizationDoc.data()?.userId !== dataOwnerId)) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }
    const organizationData = {id: organizationDoc.id, ...organizationDoc.data()} as Organization;

    const items = estimateDataFromClient.items.map(item => ({ ...item, amount: item.quantity * item.rate }));
    const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = estimateDataFromClient.taxRate || 0;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    const now = new Date().toISOString();

    const newEstimateData: Omit<Estimate, 'id'> = {
      userId: dataOwnerId,
      createdByName: authUserProfile.fullName || authUserProfile.email || "User",
      estimateNumber: estimateDataFromClient.estimateNumber,
      subjectOfWork: estimateDataFromClient.subjectOfWork || null,
      date: estimateDataFromClient.date,
      validUntil: estimateDataFromClient.validUntil,
      companyId: companyData.id!, 
      companyName: companyData.name, 
      companyAddress: companyData.address, 
      companyGstin: companyData.gstin || null, 
      companyLogoUrl: companyData.logoUrl || null, 
      companyContactPerson: companyData.contactPerson || null, 
      companyContactEmail: companyData.contactEmail || null, 
      companyContactPhone: companyData.contactPhone || null,
      organizationId: organizationData.id!, 
      organizationName: organizationData.name, 
      organizationAddress: organizationData.address || null, 
      organizationGstin: organizationData.gstin || null,
      status: estimateDataFromClient.status, items, subTotal, taxRate, taxAmount, grandTotal,
      termsAndConditions: estimateDataFromClient.termsAndConditions || null, notes: estimateDataFromClient.notes || null,
      createdAt: now, updatedAt: now,
      updatedBy: authenticatedUserUid, updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
    };

    const batch = adminDb.batch();
    const newEstimateRef = adminDb.collection('estimates').doc();
    batch.set(newEstimateRef, newEstimateData);
    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });
    await batch.commit();

    await logActivity({
        ownerId: dataOwnerId,
        actorUid: authenticatedUserUid,
        actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'create',
        entityType: 'Estimate',
        entityId: newEstimateRef.id,
        entityName: newEstimateData.estimateNumber,
        details: { message: `Estimate ${newEstimateData.estimateNumber} created for ${organizationData.name}.`, cost: actualCost }
    });

    return NextResponse.json({ id: newEstimateRef.id, ...newEstimateData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/estimates POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
