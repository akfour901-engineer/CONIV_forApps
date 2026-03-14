
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { Invoice, InvoiceItem, UserProfile, Company, Organization, TeamMember, AppConfiguration, WorkOrder } from '@/types/server-only';
import { INVOICE_CREATION_COST } from '@/lib/constants';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const invoiceItemSchema = z.object({
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().min(1, "Unit is required."),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
});

const invoiceCreateSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  companyId: z.string().min(1, "Your company is required."),
  organizationId: z.string().min(1, "Client organization is required."),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid invoice date." }),
  dueDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid due date." }),
  status: z.enum(['draft', 'sent', 'paid', 'unpaid', 'overdue', 'cancelled', 'partially-paid']).default('draft'),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required."),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  amountPaid: z.coerce.number().min(0).optional().default(0),
  paymentInstructions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  workOrderIdForLinking: z.string().optional().nullable(),
  workOrderNumber: z.string().optional().nullable(),
  paymentProofUrl: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1, "Data owner context is required."),
}).refine(data => new Date(data.dueDate) >= new Date(data.date), {
  message: "Due date cannot be before invoice date.",
  path: ["dueDate"],
});

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
                if (teamMemberData.permissions?.canViewInvoices) {
                    canAccess = true;
                }
            }
        }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    const invoicesSnapshot = await adminDb.collection('invoices')
      .where('userId', '==', requestedDataOwnerId)
      .get();
    const invoices: Invoice[] = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
    return NextResponse.json(invoices, { status: 200 });
  } catch (error: any) {
    console.error('API /api/invoices GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
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
    const validationResult = invoiceCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...invoiceDataFromClient } = validationResult.data;

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
        if (teamMemberData.permissions?.canCreateInvoices) canCreate = true;
      }
    }
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create invoices' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = INVOICE_CREATION_COST;
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "INVOICE_CREATION_COST");
            if (costConfig?.cost) {
                actualCost = costConfig.cost;
            }
        }
    } catch (configError) { console.warn("API /invoices POST: Error fetching app config for cost, using default:", configError); }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    const companyDoc = await adminDb.collection('companies').doc(invoiceDataFromClient.companyId).get();
    if (!companyDoc.exists || companyDoc.data()?.userId !== dataOwnerId) return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 });
    const companyData = {id: companyDoc.id, ...companyDoc.data()} as Company;

    const organizationDoc = await adminDb.collection('organizations').doc(invoiceDataFromClient.organizationId).get();
    if (!organizationDoc.exists || (organizationDoc.data()?.visibility !== 'public' && organizationDoc.data()?.userId !== dataOwnerId)) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }
    const organizationData = {id: organizationDoc.id, ...organizationDoc.data()} as Organization;
    
    let workOrderNumberFromDb: string | undefined | null = invoiceDataFromClient.workOrderNumber;
    if (invoiceDataFromClient.workOrderIdForLinking && !workOrderNumberFromDb) {
        const woDoc = await adminDb.collection('workOrders').doc(invoiceDataFromClient.workOrderIdForLinking).get();
        if (woDoc.exists && woDoc.data()?.userId === dataOwnerId) workOrderNumberFromDb = (woDoc.data() as WorkOrder).workOrderNumber;
    }

    const items = invoiceDataFromClient.items.map(item => ({ ...item, itemCode: item.itemCode || null, amount: item.quantity * item.rate }));
    const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = invoiceDataFromClient.taxRate || 0;
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    const amountPaid = invoiceDataFromClient.amountPaid || 0;
    const balanceDue = grandTotal - amountPaid;
    const now = new Date().toISOString();

    const newInvoiceData: Omit<Invoice, 'id'> = {
      userId: dataOwnerId,
      createdByName: authUserProfile.fullName || authUserProfile.email || "User",
      invoiceNumber: invoiceDataFromClient.invoiceNumber,
      companyId: companyData.id!, companyName: companyData.name, companyAddress: companyData.address, companyGstin: companyData.gstin || null, companyLogoUrl: companyData.logoUrl || null, companyContactPerson: companyData.contactPerson || null, companyContactEmail: companyData.contactEmail || null, companyContactPhone: companyData.contactPhone || null,
      organizationId: organizationData.id!, organizationName: organizationData.name, organizationAddress: organizationData.address || null, organizationGstin: organizationData.gstin || null,
      date: invoiceDataFromClient.date,
      dueDate: invoiceDataFromClient.dueDate,
      status: invoiceDataFromClient.status, items, subTotal, taxRate, taxAmount, grandTotal, amountPaid, balanceDue,
      paymentInstructions: invoiceDataFromClient.paymentInstructions || null, notes: invoiceDataFromClient.notes || null,
      workOrderId: invoiceDataFromClient.workOrderIdForLinking || null, workOrderNumber: workOrderNumberFromDb || null,
      paymentProofUrl: invoiceDataFromClient.paymentProofUrl || null,
      createdAt: now, updatedAt: now,
      updatedBy: authenticatedUserUid, updatedByName: authUserProfile.fullName || authUserProfile.email || "User",
    };
    
    const cleanedData: { [key: string]: any } = {};
    for (const key in newInvoiceData) { if (newInvoiceData[key as keyof typeof newInvoiceData] !== undefined) { cleanedData[key] = newInvoiceData[key as keyof typeof newInvoiceData]; } }

    const batch = adminDb.batch();
    const newInvoiceRef = adminDb.collection('invoices').doc();
    batch.set(newInvoiceRef, cleanedData);
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
      entityType: 'Invoice',
      entityId: newInvoiceRef.id,
      entityName: newInvoiceData.invoiceNumber,
      details: { message: `Invoice ${newInvoiceData.invoiceNumber} created for ${organizationData.name}.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newInvoiceRef.id, ...newInvoiceData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/invoices POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
