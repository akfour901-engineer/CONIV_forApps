


import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { Invoice, InvoiceItem, UserProfile, Company, Organization, TeamMember, WorkOrder, OtherDeduction } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { format } from 'date-fns';
export const dynamic = 'force-dynamic';
const invoiceItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().min(1, "Unit is required."),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
});

const otherDeductionSchema = z.object({
    description: z.string().min(1, "Deduction description is required."),
    amount: z.coerce.number().positive("Deduction amount must be positive."),
});

const invoiceUpdateSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required.").optional(),
  companyId: z.string().min(1, "Company ID is required.").optional(),
  organizationId: z.string().min(1, "Organization ID is required.").optional(),
  date: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  status: z.enum(['draft', 'sent', 'paid', 'unpaid', 'overdue', 'cancelled', 'partially-paid']).optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required.").optional(),
  discount: z.coerce.number().min(0).optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentInstructions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  workOrderIdForLinking: z.string().optional().nullable(), 
  workOrderNumber: z.string().optional().nullable(),
  paymentProofUrl: z.string().optional().nullable(),
  sdDeducted: z.coerce.number().min(0).optional().nullable(),
  tdsDeducted: z.coerce.number().min(0).optional().nullable(),
  ldDeducted: z.coerce.number().min(0).optional().nullable(),
  otherDeductions: z.array(otherDeductionSchema).optional().nullable(),
}).refine(data => !data.dueDate || !data.date || new Date(data.dueDate) >= new Date(data.date), {
  message: "Due date cannot be before invoice date.",
  path: ["dueDate"],
});

async function authorizeAndGetInvoice(
  invoiceId: string, 
  authenticatedUserUid: string, 
  requiredPermissionKey: keyof TeamMember['permissions'] | null
): Promise<{ authorized: boolean; invoiceData?: Invoice; dataOwnerId?: string; error?: string; status?: number }> {
  
  const invoiceDocRef = adminDb.collection('invoices').doc(invoiceId);
  const invoiceSnap = await invoiceDocRef.get();
  if (!invoiceSnap.exists) return { authorized: false, error: 'Invoice not found', status: 404 };
  
  const invoiceData = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;
  const itemOwnerId = invoiceData.userId;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
  const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  
  // User is the direct owner of the item
  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, invoiceData, dataOwnerId: itemOwnerId };
  }

  // A team member can access their owner's items if they have permission.
  if (authUserProfile.ownerId === itemOwnerId) {
    if (!requiredPermissionKey) { // Some actions might not need a specific perm key, just being a member
        return { authorized: true, invoiceData, dataOwnerId: itemOwnerId };
    }
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.[requiredPermissionKey]) {
        return { authorized: true, invoiceData, dataOwnerId: itemOwnerId };
      }
    }
  }

  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { invoiceId: string } }) {
  const { invoiceId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // For GETting a template, a user only needs to be able to create invoices in general.
    const authResult = await authorizeAndGetInvoice(invoiceId, decodedToken.uid, 'canViewInvoices');
    if (!authResult.authorized || !authResult.invoiceData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.invoiceData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/invoices/[${invoiceId}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { invoiceId: string } }) {
  const { invoiceId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;

    const authResult = await authorizeAndGetInvoice(invoiceId, authenticatedUserUid, 'canEditInvoices');
    if (!authResult.authorized || !authResult.invoiceData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    const requestBody = await request.json();
    const validationResult = invoiceUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    
    const dataToUpdate: Partial<Invoice> = {};

    if (dataFromClient.invoiceNumber) dataToUpdate.invoiceNumber = dataFromClient.invoiceNumber;
    
    const toDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (dataFromClient.date) dataToUpdate.date = toDateString(new Date(dataFromClient.date));
    if (dataFromClient.dueDate) dataToUpdate.dueDate = toDateString(new Date(dataFromClient.dueDate));
    
    const originalStatus = authResult.invoiceData.status;
    if (dataFromClient.status && dataFromClient.status !== originalStatus) {
        const permissionKeyForStatusChange: keyof TeamMember['permissions'] = 'canChangeInvoiceStatus';
        let canChangeStatus = authenticatedUserUid === authResult.dataOwnerId; // Owner can always change
        if (!canChangeStatus && authUserProfile.ownerId === authResult.dataOwnerId) { // Team member
            const teamMemberDocRef = adminDb.collection('users').doc(authResult.dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if (teamMemberDocSnap.exists) {
                const teamMemberData = teamMemberDocSnap.data() as TeamMember;
                if (teamMemberData.permissions?.[permissionKeyForStatusChange]) canChangeStatus = true;
            }
        }
        if (!canChangeStatus) {
             return NextResponse.json({ error: 'Forbidden: You do not have permission to change invoice status.' }, { status: 403 });
        }
        dataToUpdate.status = dataFromClient.status;
    } else if (dataFromClient.status) {
      dataToUpdate.status = dataFromClient.status;
    }

    if (dataFromClient.discount !== undefined) dataToUpdate.discount = dataFromClient.discount;
    if (dataFromClient.taxRate !== undefined) dataToUpdate.taxRate = dataFromClient.taxRate;
    if (dataFromClient.paymentInstructions !== undefined) dataToUpdate.paymentInstructions = dataFromClient.paymentInstructions;
    if (dataFromClient.notes !== undefined) dataToUpdate.notes = dataFromClient.notes;
    
    // New payment proof fields
    if (dataFromClient.paymentProofUrl !== undefined) dataToUpdate.paymentProofUrl = dataFromClient.paymentProofUrl;
    if (dataFromClient.amountPaid !== undefined) dataToUpdate.amountPaid = dataFromClient.amountPaid;
    if (dataFromClient.sdDeducted !== undefined) dataToUpdate.sdDeducted = dataFromClient.sdDeducted;
    if (dataFromClient.tdsDeducted !== undefined) dataToUpdate.tdsDeducted = dataFromClient.tdsDeducted;
    if (dataFromClient.ldDeducted !== undefined) dataToUpdate.ldDeducted = dataFromClient.ldDeducted;
    if (dataFromClient.otherDeductions !== undefined) dataToUpdate.otherDeductions = dataFromClient.otherDeductions;


    if (dataFromClient.companyId && dataFromClient.companyId !== authResult.invoiceData.companyId) {
      const companyDoc = await adminDb.collection('companies').doc(dataFromClient.companyId).get();
      if (!companyDoc.exists || companyDoc.data()?.userId !== authResult.dataOwnerId) return NextResponse.json({ error: 'New company not found or access denied' }, { status: 404 });
      const companyData = {id: companyDoc.id, ...companyDoc.data()} as Company;
      dataToUpdate.companyId = companyData.id!; dataToUpdate.companyName = companyData.name; dataToUpdate.companyAddress = companyData.address; dataToUpdate.companyGstin = companyData.gstin; dataToUpdate.companyLogoUrl = companyData.logoUrl; dataToUpdate.companyContactPerson = companyData.contactPerson; dataToUpdate.companyContactEmail = companyData.contactEmail; dataToUpdate.companyContactPhone = companyData.contactPhone;
    }

    if (dataFromClient.organizationId && dataFromClient.organizationId !== authResult.invoiceData.organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(dataFromClient.organizationId).get();
      if (!orgDoc.exists || (orgDoc.data()?.visibility !== 'public' && orgDoc.data()?.userId !== authResult.dataOwnerId)) return NextResponse.json({ error: 'New organization not found or access denied' }, { status: 404 });
      const orgData = {id: orgDoc.id, ...orgDoc.data()} as Organization;
      dataToUpdate.organizationId = orgData.id!; dataToUpdate.organizationName = orgData.name; dataToUpdate.organizationAddress = orgData.address; dataToUpdate.organizationGstin = orgData.gstin;
    }

    if (dataFromClient.workOrderIdForLinking !== undefined) { 
        if (dataFromClient.workOrderIdForLinking && dataFromClient.workOrderIdForLinking !== authResult.invoiceData.workOrderId) {
            const woDoc = await adminDb.collection('workOrders').doc(dataFromClient.workOrderIdForLinking).get();
            if (woDoc.exists && woDoc.data()?.userId === authResult.dataOwnerId) {
                const woData = { id: woDoc.id, ...woDoc.data() } as WorkOrder;
                dataToUpdate.workOrderId = woData.id;
                dataToUpdate.workOrderNumber = woData.workOrderNumber;
            } else {
                console.warn(`Attempt to link invoice ${invoiceId} to non-existent/unauthorized WO ${dataFromClient.workOrderIdForLinking}`);
                 dataToUpdate.workOrderId = authResult.invoiceData.workOrderId; 
                 dataToUpdate.workOrderNumber = authResult.invoiceData.workOrderNumber;
            }
        } else if (dataFromClient.workOrderIdForLinking === null || dataFromClient.workOrderIdForLinking === "") {
            dataToUpdate.workOrderId = null;
            dataToUpdate.workOrderNumber = null;
        }
    } else if (dataFromClient.workOrderNumber !== undefined && dataFromClient.workOrderNumber !== authResult.invoiceData.workOrderNumber) {
        dataToUpdate.workOrderNumber = dataFromClient.workOrderNumber;
        if (!dataFromClient.workOrderNumber) dataToUpdate.workOrderId = null; 
    }

    if (dataFromClient.items || dataFromClient.taxRate !== undefined || dataFromClient.amountPaid !== undefined || dataFromClient.sdDeducted !== undefined || dataFromClient.tdsDeducted !== undefined || dataFromClient.ldDeducted !== undefined || dataFromClient.otherDeductions !== undefined || dataFromClient.discount !== undefined) {
      const items = dataFromClient.items ? dataFromClient.items.map(item => { const {id, ...dbItem} = item; return ({ ...dbItem, itemCode: dbItem.itemCode || null, amount: item.quantity * item.rate });}) : authResult.invoiceData.items;
      dataToUpdate.items = items;
      const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
      const discount = dataFromClient.discount ?? authResult.invoiceData.discount ?? 0;
      const taxableValue = subTotal - discount;
      const taxRate = dataFromClient.taxRate ?? authResult.invoiceData.taxRate ?? 0;
      const taxAmount = (taxableValue * taxRate) / 100;
      const grandTotal = taxableValue + taxAmount;
      
      const amountPaid = dataFromClient.amountPaid ?? authResult.invoiceData.amountPaid ?? 0;
      const sdDeducted = dataFromClient.sdDeducted ?? authResult.invoiceData.sdDeducted ?? 0;
      const tdsDeducted = dataFromClient.tdsDeducted ?? authResult.invoiceData.tdsDeducted ?? 0;
      const ldDeducted = dataFromClient.ldDeducted ?? authResult.invoiceData.ldDeducted ?? 0;
      const otherDeductionsTotal = (dataFromClient.otherDeductions ?? authResult.invoiceData.otherDeductions ?? []).reduce((sum, d) => sum + d.amount, 0);
      const totalDeductions = sdDeducted + tdsDeducted + ldDeducted + otherDeductionsTotal;
      
      dataToUpdate.subTotal = subTotal;
      dataToUpdate.discount = discount;
      dataToUpdate.taxableValue = taxableValue;
      dataToUpdate.taxRate = taxRate;
      dataToUpdate.taxAmount = taxAmount;
      dataToUpdate.grandTotal = grandTotal;
      dataToUpdate.amountPaid = amountPaid;
      dataToUpdate.balanceDue = grandTotal - amountPaid - totalDeductions;
    }

    dataToUpdate.updatedAt = new Date().toISOString();
    dataToUpdate.updatedBy = authenticatedUserUid;
    dataToUpdate.updatedByName = authUserProfile.fullName || authUserProfile.email || "User";
    
    Object.keys(dataToUpdate).forEach(key => dataToUpdate[key as keyof typeof dataToUpdate] === undefined && delete dataToUpdate[key as keyof typeof dataToUpdate]);

    const invoiceDocRef = adminDb.collection('invoices').doc(invoiceId);
    await invoiceDocRef.update(dataToUpdate);
    
    const newStatus = dataToUpdate.status;
    let logDetailsMessage = `Invoice ${dataToUpdate.invoiceNumber || authResult.invoiceData.invoiceNumber} updated.`;
    if (newStatus && newStatus !== originalStatus) {
        logDetailsMessage = `Invoice ${dataToUpdate.invoiceNumber || authResult.invoiceData.invoiceNumber} status changed from '${originalStatus}' to '${newStatus}'.`;
    }
    if (dataFromClient.paymentProofUrl) {
      logDetailsMessage = `Payment proof attached/updated for Invoice ${dataToUpdate.invoiceNumber || authResult.invoiceData.invoiceNumber}.`
    }

    await logActivity({
        ownerId: authResult.dataOwnerId,
        actorUid: authenticatedUserUid,
        actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'update',
        entityType: 'Invoice',
        entityId: invoiceId,
        entityName: dataToUpdate.invoiceNumber || authResult.invoiceData.invoiceNumber,
        details: logDetailsMessage
    });

    const updatedDoc = await invoiceDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/invoices/[${invoiceId}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { invoiceId: string } }) {
  const { invoiceId } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 });
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    const authResult = await authorizeAndGetInvoice(invoiceId, authenticatedUserUid, 'canDeleteInvoices');
    if (!authResult.authorized || !authResult.invoiceData || !authResult.dataOwnerId) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });

    if (authResult.invoiceData.status === 'paid' || authResult.invoiceData.status === 'sent' || authResult.invoiceData.status === 'partially-paid') {
        return NextResponse.json({ error: 'Cannot delete a paid, sent, or partially-paid invoice. Please cancel it first.', code: 'INVOICE_STATUS_DELETE_RESTRICTED' }, { status: 409 });
    }

    await adminDb.collection('invoices').doc(invoiceId).delete();
    
    await logActivity({
        ownerId: authResult.dataOwnerId,
        actorUid: authenticatedUserUid,
        actorName: authUserProfile.fullName || authUserProfile.email || "User",
        actionType: 'delete',
        entityType: 'Invoice',
        entityId: invoiceId,
        entityName: authResult.invoiceData.invoiceNumber,
        details: `Invoice ${authResult.invoiceData.invoiceNumber} deleted.`
    });
    return NextResponse.json({ message: 'Invoice deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/invoices/[${invoiceId}] DELETE error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
