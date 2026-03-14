

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { PurchaseOrder, PurchaseOrderItem, UserProfile, Company, Organization, TeamMember, AppConfiguration, WorkOrder, Subcontractor } from '@/types/server-only';
import { PURCHASE_ORDER_CREATION_COST } from '@/lib/constants';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const purchaseOrderItemSchema = z.object({
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().min(1, "Unit is required."),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
  type: z.enum(['material', 'service']).default('material'),
});

const purchaseOrderCreateSchema = z.object({
  poNumber: z.string().min(1, "PO number is required.").max(100),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid PO date." }),
  companyId: z.string().min(1, "Issuing company is required."),
  supplierType: z.enum(['organization', 'subcontractor']),
  supplierOrganizationId: z.string().optional().nullable(),
  supplierSubcontractorId: z.string().optional().nullable(),
  workOrderId: z.string().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required."),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  shippingAddress: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  paymentTerms: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'billed', 'cancelled']).default('draft'),
}).refine(data => data.supplierType === 'organization' ? !!data.supplierOrganizationId : !!data.supplierSubcontractorId, {
    message: "A supplier must be selected based on the supplier type.",
    path: ["supplierOrganizationId"], 
});


export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    if (!requestedDataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const authUserProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = authUserProfileDoc.data() as UserProfile;

    let canAccess = false;
    if(decodedToken.uid === requestedDataOwnerId) canAccess = true;
    else if (authUserProfile.ownerId === requestedDataOwnerId) {
        const teamMemberDocSnap = await adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(decodedToken.uid).get();
        if (teamMemberDocSnap.exists && (teamMemberDocSnap.data() as TeamMember).permissions?.canViewPurchaseOrders) canAccess = true;
    }
    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    const snapshot = await adminDb.collection('purchaseOrders')
      .where('userId', '==', requestedDataOwnerId)
      .get();
      
    if (snapshot.empty) {
        return NextResponse.json([], { status: 200 });
    }
      
    const poList: PurchaseOrder[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
    
    // Sort in code to avoid needing a composite index
    poList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(poList, { status: 200 });
  } catch (error: any) {
    console.error('API /api/purchase-orders GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const requestBody = await request.json();
    const validationResult = purchaseOrderCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    const poDataFromClient = validationResult.data;

    const authUserProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = authUserProfileDoc.data() as UserProfile;
    const dataOwnerId = authUserProfile.ownerId || decodedToken.uid;

    let canCreate = false;
    if(decodedToken.uid === dataOwnerId) canCreate = true;
    else if (authUserProfile.ownerId) {
        const teamMemberDocSnap = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(decodedToken.uid).get();
        if (teamMemberDocSnap.exists && (teamMemberDocSnap.data() as TeamMember).permissions?.canCreatePurchaseOrders) canCreate = true;
    }
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create purchase orders' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = PURCHASE_ORDER_CREATION_COST;
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "PURCHASE_ORDER_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') {
                actualCost = costConfig.cost;
            }
        }
    } catch (configError: any) {
        console.warn("API /purchase-orders POST: Error fetching app config for cost, using default:", configError);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    const companyDoc = await adminDb.collection('companies').doc(poDataFromClient.companyId).get();
    if (!companyDoc.exists || companyDoc.data()?.userId !== dataOwnerId) return NextResponse.json({ error: 'Issuing company not found or access denied.' }, { status: 404 });
    const companyData = companyDoc.data() as Company;

    let supplierName: string;
    if (poDataFromClient.supplierType === 'organization' && poDataFromClient.supplierOrganizationId) {
        const orgDoc = await adminDb.collection('organizations').doc(poDataFromClient.supplierOrganizationId).get();
        if (!orgDoc.exists || (orgDoc.data()?.visibility !== 'public' && orgDoc.data()?.userId !== dataOwnerId)) return NextResponse.json({ error: 'Supplier organization not found or access denied.' }, { status: 404 });
        supplierName = (orgDoc.data() as Organization).name;
    } else if (poDataFromClient.supplierType === 'subcontractor' && poDataFromClient.supplierSubcontractorId) {
        const subDoc = await adminDb.collection('subcontractors').doc(poDataFromClient.supplierSubcontractorId).get();
        if (!subDoc.exists || subDoc.data()?.userId !== dataOwnerId) return NextResponse.json({ error: 'Supplier subcontractor not found or access denied.' }, { status: 404 });
        supplierName = (subDoc.data() as Subcontractor).name;
    } else {
        return NextResponse.json({ error: 'Invalid supplier details provided.' }, { status: 400 });
    }
    
    let workOrderData: WorkOrder | undefined;
    if(poDataFromClient.workOrderId) {
        const workOrderDoc = await adminDb.collection('workOrders').doc(poDataFromClient.workOrderId).get();
        if (workOrderDoc.exists && workOrderDoc.data()?.userId === dataOwnerId) {
            workOrderData = workOrderDoc.data() as WorkOrder;
        }
    }


    const items = poDataFromClient.items.map(item => ({ ...item, itemCode: item.itemCode || null, amount: item.quantity * item.rate }));
    const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = poDataFromClient.taxRate || 0;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    const now = new Date().toISOString();

    const newPOData: Omit<PurchaseOrder, 'id'> = {
        userId: dataOwnerId,
        createdByName: authUserProfile.fullName || authUserProfile.email || "User",
        poNumber: poDataFromClient.poNumber,
        date: poDataFromClient.date,
        companyId: companyDoc.id,
        companyName: companyData.name,
        supplierType: poDataFromClient.supplierType,
        supplierOrganizationId: poDataFromClient.supplierOrganizationId || null,
        supplierSubcontractorId: poDataFromClient.supplierSubcontractorId || null,
        supplierOrganizationName: supplierName,
        workOrderId: workOrderData?.id || null,
        workOrderNumber: workOrderData?.workOrderNumber || null,
        items, subTotal, taxRate, taxAmount, grandTotal,
        shippingAddress: poDataFromClient.shippingAddress || null,
        billingAddress: poDataFromClient.billingAddress || null,
        paymentTerms: poDataFromClient.paymentTerms || null,
        notes: poDataFromClient.notes || null,
        status: poDataFromClient.status,
        createdAt: now, updatedAt: now,
        updatedBy: decodedToken.uid, updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
        linkedExpenseId: null, // Initialize as null
    };

    const batch = adminDb.batch();
    const newPORef = adminDb.collection('purchaseOrders').doc();
    batch.set(newPORef, newPOData);
    batch.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-actualCost) });
    await batch.commit();

    await logActivity({
        ownerId: dataOwnerId, actorUid: decodedToken.uid, actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'create', entityType: 'PurchaseOrder', entityId: newPORef.id, entityName: newPOData.poNumber,
        details: { message: `PO ${newPOData.poNumber} created for supplier ${supplierName}.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newPORef.id, ...newPOData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/purchase-orders POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
