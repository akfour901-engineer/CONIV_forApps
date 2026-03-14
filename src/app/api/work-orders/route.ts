
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { WorkOrder, WorkOrderItem, UserProfile, Company, Organization, TeamMember, AppConfiguration } from '@/types/server-only';
import { WORK_ORDER_CREATION_COST } from '@/lib/constants';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const workOrderItemSchema = z.object({
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().min(1, "Unit is required."),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
});

const workOrderCreateSchema = z.object({
  workOrderNumber: z.string().min(1, "Work Order number is required.").max(100),
  companyId: z.string().min(1, "Company is required."),
  organizationId: z.string().min(1, "Client is required."),
  startDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid start date." }),
  endDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid end date." }),
  securityDeposit: z.coerce.number().optional().nullable(),
  depositPeriod: z.coerce.number().int().optional().nullable(),
  scopeOfWork: z.string().max(5000).optional().nullable(),
  status: z.enum(['draft', 'pending', 'approved', 'in-progress', 'completed', 'on-hold', 'cancelled']).default('draft'),
  items: z.array(workOrderItemSchema).min(1, "At least one item is required."),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  awardProofUrl: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1, "Data owner context is required."),
  estimateId: z.string().optional().nullable(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
    if (authenticatedUserUid === requestedDataOwnerId) return true;
    
    const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (memberProfileDoc.exists && (memberProfileDoc.data() as UserProfile).ownerId === requestedDataOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const permissions = (teamMemberDocSnap.data() as TeamMember).permissions;
            if (permissions?.canViewWorkOrders || permissions?.canCreateInvoices || permissions?.canManageLabourRegister || permissions?.canManageDpr || permissions?.canManageSvr) {
                return true;
            }
        }
    }
    return false;
}

export async function GET(request: Request) {
  const functionCallId = `api_work-orders_GET_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    if (!requestedDataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });
    }

    const hasPermission = await checkPermissions(authenticatedUserUid, requestedDataOwnerId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });
    }

    const workOrdersSnapshot = await adminDb.collection('workOrders').where('userId', '==', requestedDataOwnerId).get();
      
    const workOrders: WorkOrder[] = workOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
    
    return NextResponse.json(workOrders, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/work-orders GET handler:`, error);
    const errorMessageText = (error as any).message || 'An unspecified error occurred.';
    const errorCode = (error as any).code || 'UNKNOWN_SERVER_ERROR_WO_GET';
    
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
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = workOrderCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...woDataFromClient } = validationResult.data;

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
        if (teamMemberData.permissions?.canCreateWorkOrders) canCreate = true;
      }
    }
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create work orders for this account.' }, { status: 403 });
    
    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = WORK_ORDER_CREATION_COST;
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "WORK_ORDER_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') {
                actualCost = costConfig.cost;
            }
        }
    } catch (configError) { console.warn("API /work-orders POST: Error fetching app config for cost, using default:", configError); }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const companyDoc = await adminDb.collection('companies').doc(woDataFromClient.companyId).get();
    if (!companyDoc.exists || companyDoc.data()?.userId !== dataOwnerId) return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 });
    const companyData = {id: companyDoc.id, ...companyDoc.data()} as Company;

    const organizationDoc = await adminDb.collection('organizations').doc(woDataFromClient.organizationId).get();
    if (!organizationDoc.exists || (organizationDoc.data()?.visibility !== 'public' && organizationDoc.data()?.userId !== dataOwnerId)) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }
    const organizationData = {id: organizationDoc.id, ...organizationDoc.data()} as Organization;
    
    let workOrderNumberFromDb: string | undefined | null = 'workOrderNumber' in woDataFromClient ? woDataFromClient.workOrderNumber : null;
    
    const estimateIdFromClient = woDataFromClient.estimateId;

    const items = woDataFromClient.items.map(item => ({ ...item, itemCode: item.itemCode || null, amount: item.quantity * item.rate }));
    const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = woDataFromClient.taxRate || 0;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    const now = new Date().toISOString();

    const newWOData: Omit<WorkOrder, 'id'> = {
      userId: dataOwnerId,
      createdByName: authUserProfile.fullName || authUserProfile.email || "User",
      workOrderNumber: woDataFromClient.workOrderNumber,
      organizationId: organizationData.id!,
      organizationName: organizationData.name,
      organizationAddress: organizationData.address || null,
      companyId: companyData.id!,
      companyName: companyData.name,
      companyAddress: companyData.address,
      startDate: woDataFromClient.startDate,
      endDate: woDataFromClient.endDate,
      securityDeposit: woDataFromClient.securityDeposit ?? null,
      depositPeriod: woDataFromClient.depositPeriod ?? null,
      scopeOfWork: woDataFromClient.scopeOfWork || null,
      status: woDataFromClient.status, items, subTotal, taxRate, taxAmount, grandTotal,
      termsAndConditions: woDataFromClient.termsAndConditions || null,
      awardProofUrl: woDataFromClient.awardProofUrl || null,
      createdAt: now, updatedAt: now,
      updatedBy: authenticatedUserUid, updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
      estimateId: estimateIdFromClient || null,
    };

    const batch = adminDb.batch();
    const newWorkOrderRef = adminDb.collection('workOrders').doc();
    batch.set(newWorkOrderRef, newWOData);
    
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
        entityType: 'WorkOrder',
        entityId: newWorkOrderRef.id,
        entityName: newWOData.workOrderNumber,
        details: { message: `Work Order ${newWOData.workOrderNumber} created for ${organizationData.name}.`, cost: actualCost }
    });

    return NextResponse.json({ id: newWorkOrderRef.id, ...newWOData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/work-orders POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
