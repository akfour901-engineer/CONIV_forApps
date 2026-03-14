



import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { Estimate, EstimateItem, UserProfile, Company, Organization, TeamMember, WorkOrder } from '@/types/server-only';
import { ESTIMATE_STATUS_OPTIONS } from '@/types/server-only';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { format } from 'date-fns';
export const dynamic = 'force-dynamic';
const estimateItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().min(1, "Unit is required."),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
});

const estimateUpdateSchema = z.object({
  estimateNumber: z.string().min(1, "Estimate number is required.").optional(),
  subjectOfWork: z.string().max(500).optional().nullable(),
  date: z.union([z.string(), z.date()]).optional(),
  validUntil: z.union([z.string(), z.date()]).optional().nullable(),
  companyId: z.string().min(1, "Company ID is required.").optional(),
  organizationId: z.string().min(1, "Organization ID is required.").optional(),
  status: z.enum(ESTIMATE_STATUS_OPTIONS as [string, ...string[]]).optional(),
  items: z.array(estimateItemSchema).min(1, "At least one item is required.").optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).refine(data => !data.validUntil || !data.date || new Date(data.validUntil) >= new Date(data.date), {
  message: "Valid until date cannot be before estimate date.",
  path: ["validUntil"],
});

async function authorizeAndGetEstimate(
  estimateId: string,
  authenticatedUserUid: string
): Promise<{ authorized: boolean; estimateData?: Estimate; dataOwnerId?: string; error?: string; status?: number }> {
    const estimateDocRef = adminDb.collection('estimates').doc(estimateId);
    const estimateSnap = await estimateDocRef.get();

    if (!estimateSnap.exists) {
        return { authorized: false, error: 'Estimate not found', status: 404 };
    }
    const estimateData = { id: estimateSnap.id, ...estimateSnap.data() } as Estimate;
    const itemOwnerId = estimateData.userId;

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    // User is the direct owner
    if (authenticatedUserUid === itemOwnerId) {
        return { authorized: true, estimateData, dataOwnerId: itemOwnerId };
    }

    // User is a team member
    if (authUserProfile.ownerId === itemOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canViewEstimates) { // Use a broad permission for viewing
                return { authorized: true, estimateData, dataOwnerId: itemOwnerId };
            }
        }
    }

    return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAndGetEstimate(id, decodedToken.uid);
    if (!authResult.authorized || !authResult.estimateData) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    return NextResponse.json(authResult.estimateData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/estimates/[${id}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAndGetEstimate(id, decodedToken.uid);
    if (!authResult.authorized || !authResult.estimateData || !authResult.dataOwnerId) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    const requestBody = await request.json();
    const validationResult = estimateUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const dataToUpdate = validationResult.data;
    
    if (dataToUpdate.date && typeof dataToUpdate.date !== 'string') {
      dataToUpdate.date = format(dataToUpdate.date, 'yyyy-MM-dd');
    }
    if (dataToUpdate.validUntil && typeof dataToUpdate.validUntil !== 'string') {
      dataToUpdate.validUntil = format(dataToUpdate.validUntil, 'yyyy-MM-dd');
    }
    
    // Recalculate totals if items are included in the update
    if (dataToUpdate.items) {
        const items = dataToUpdate.items.map(item => ({...item, amount: item.quantity * item.rate }));
        const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
        const taxRate = dataToUpdate.taxRate ?? authResult.estimateData.taxRate ?? 0;
        const taxAmount = (subTotal * taxRate) / 100;
        const grandTotal = subTotal + taxAmount;

        (dataToUpdate as any).items = items;
        (dataToUpdate as any).subTotal = subTotal;
        (dataToUpdate as any).taxAmount = taxAmount;
        (dataToUpdate as any).grandTotal = grandTotal;
    }
    
    await adminDb.collection('estimates').doc(id).update(dataToUpdate);
    
    return NextResponse.json({ message: 'Estimate updated successfully.' }, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/estimates/[${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const authResult = await authorizeAndGetEstimate(id, decodedToken.uid);
    if (!authResult.authorized || !authResult.estimateData) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    if (['approved', 'submitted'].includes(authResult.estimateData.status)) {
        return NextResponse.json({ error: 'Cannot delete an active estimate. Please expire or reject it first.' }, { status: 409 });
    }

    await adminDb.collection('estimates').doc(id).delete();
    
    return NextResponse.json({ message: 'Estimate deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/estimates/[${id}] DELETE error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
