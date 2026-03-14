

import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { Company, Organization, Estimate, SorRate, TeamPermissions, UserProfile, AppConfiguration } from '@/types';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { SOR_RATE_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  const adminDb = getDb();
  // A user can always access their own data.
  if (authenticatedUserUid === requestedDataOwnerId) {
    return true;
  }
  
  const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!userProfileDoc.exists) {
    console.warn(`form-data check: User profile for ${authenticatedUserUid} not found.`);
    return false;
  }
  const userProfile = userProfileDoc.data() as UserProfile;

  // A team member can access their owner's data if they have permission.
  if (userProfile.ownerId === requestedDataOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const permissions = teamMemberDocSnap.data()?.permissions as TeamPermissions;
      // Allow if user has permission to create work orders or estimates (which requires this data)
      if (permissions?.canCreateWorkOrders || permissions?.canCreateEstimates || permissions?.canManageOwnerSORs) {
        return true;
      }
    }
  }
  return false;
}

const sorRateCreateSchema = z.object({
  itemCode: z.string().min(1, "Item code is required.").max(50),
  itemDescription: z.string().min(1, "Description is required.").max(500),
  unit: z.string().min(1, "Unit is required.").max(20),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
  organizationId: z.string().optional().nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
});


export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = sorRateCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    const sorDataFromClient = validationResult.data;

    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!userProfileDoc.exists) return NextResponse.json({ error: 'User profile not found for authenticated user' }, { status: 403 });
    const userProfile = userProfileDoc.data() as UserProfile;
    const dataOwnerId = userProfile.ownerId || authenticatedUserUid;
    
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) {
        canCreate = true;
    } else if (userProfile.ownerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as any; // Cast to any to access permissions
            if(teamMemberData.permissions?.canManageOwnerSORs) {
                canCreate = true;
            }
        }
    }
    
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create SOR items' }, { status: 403 });

    let actualCost = SOR_RATE_CREATION_COST;
    if (sorDataFromClient.visibility === 'private') {
        const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
        const pointPayerProfileSnap = await pointPayerProfileRef.get();
        if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
        
        const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
        
        try {
            const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
            const appConfigSnap = await appConfigDocRef.get();
            if (appConfigSnap.exists) {
                const configData = appConfigSnap.data() as AppConfiguration;
                const costConfig = configData.actionCosts?.find(c => c.key === "SOR_RATE_CREATION_COST");
                if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
            }
        } catch (configError: any) {
            console.warn(`API /sor-rates POST: Error fetching app config for cost, using default: ${actualCost}.`);
        }

        if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
            return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
        }
    } else {
        actualCost = 0; // Public items are free
    }

    const now = new Date().toISOString();
    let organizationName: string | null = null;
    if (sorDataFromClient.organizationId) {
        const orgDoc = await adminDb.collection('organizations').doc(sorDataFromClient.organizationId).get();
        if(orgDoc.exists) organizationName = (orgDoc.data() as Organization).name;
    }

    const newSorRateData: Omit<SorRate, 'id'> = {
      userId: dataOwnerId,
      createdByName: userProfile.fullName || userProfile.email || "User",
      ...sorDataFromClient,
      organizationName: organizationName,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: userProfile.fullName || userProfile.email || "User",
    };
    
    const newSorRateRef = adminDb.collection('sorRates').doc();
    
    const batch = adminDb.batch();
    batch.set(newSorRateRef, newSorRateData);

    let newResourcePoints: number | undefined;
    if (actualCost > 0) {
        const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
        const currentPoints = (await pointPayerProfileRef.get()).data()?.resourcePoints ?? 0;
        newResourcePoints = currentPoints - actualCost;
        batch.update(pointPayerProfileRef, { resourcePoints: newResourcePoints, resourcePointsLastUpdated: now });
    }
    
    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: userProfile.fullName || userProfile.email || "User",
      actionType: 'create', entityType: 'SorRate', entityId: newSorRateRef.id, entityName: newSorRateData.itemCode,
      details: { message: `SOR item '${newSorRateData.itemCode}' created.`, cost: actualCost > 0 ? actualCost : undefined }
    });

    return NextResponse.json({ id: newSorRateRef.id, ...newSorRateData, newResourcePoints, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/sor-rates POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}


export async function GET(request: Request) {
  const functionCallId = `api_sor_rates_GET_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });

    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    if (!dataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });
    
    const hasPermission = await checkPermissions(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [userSorRatesSnap, publicSorSnap] = await Promise.all([
      adminDb.collection('sorRates').where('userId', '==', dataOwnerId).get(),
      adminDb.collection('sorRates').where('visibility', '==', 'public').get()
    ]);
    
    if (userSorRatesSnap.empty && publicSorSnap.empty) {
        return NextResponse.json([], { status: 200 });
    }

    const sorRatesMap = new Map<string, SorRate>();
    userSorRatesSnap.docs.forEach(doc => sorRatesMap.set(doc.id, { id: doc.id, ...doc.data() } as SorRate));
    publicSorSnap.docs.forEach(doc => {
        if (!sorRatesMap.has(doc.id)) {
            sorRatesMap.set(doc.id, { id: doc.id, ...doc.data() } as SorRate);
        }
    });
    const combinedSorRates = Array.from(sorRatesMap.values());

    return NextResponse.json(combinedSorRates, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error fetching sor-rates form data:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

    