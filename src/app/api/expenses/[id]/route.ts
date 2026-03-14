


import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { Expense, Company, WorkOrder, UserProfile, TeamMember } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { format, parseISO } from 'date-fns';
export const dynamic = 'force-dynamic';
const expenseUpdateSchema = z.object({
  date: z.union([z.string(), z.date()]).optional(),
  category: z.string().min(1, "Category is required.").max(100).optional(),
  description: z.string().min(1, "Description is required.").max(500).optional(),
  amount: z.coerce.number().positive("Amount must be positive.").optional(),
  receiptUrl: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  workOrderId: z.string().optional().nullable(),
});

async function authorizeAccess(
  expenseId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; expenseData?: Expense; dataOwnerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
  
  const expenseDocRef = adminDb.collection('expenses').doc(expenseId);
  const expenseSnap = await expenseDocRef.get();

  if (!expenseSnap.exists) {
    return { authorized: false, error: 'Expense not found', status: 404 };
  }
  const expenseData = { id: expenseSnap.id, ...expenseSnap.data() } as Expense;
  const itemOwnerId = expenseData.userId;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) {
    return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
  }
  const actorProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  const actorDataOwnerContext = actorProfile.ownerId || actorProfile.uid;
  
  if (itemOwnerId !== actorDataOwnerContext) {
      return { authorized: false, error: 'Forbidden: This expense does not belong to your data scope.', status: 403 };
  }

  if (authenticatedUserUid === itemOwnerId) {
    return { authorized: true, expenseData, dataOwnerId: itemOwnerId, actorProfile };
  }

  if (actorProfile.ownerId === itemOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.canManageExpenses) {
        return { authorized: true, expenseData, dataOwnerId: itemOwnerId, actorProfile };
      }
    }
  }

  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { id: string } }) {
  const expenseId = params.id;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authResult = await authorizeAccess(expenseId, decodedToken.uid);
    if (!authResult.authorized || !authResult.expenseData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.expenseData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/expenses/[${expenseId}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const expenseId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const authResult = await authorizeAccess(expenseId, decodedToken.uid);
        if (!authResult.authorized || !authResult.expenseData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }
        
        const requestBody = await request.json();
        const validationResult = expenseUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
        }
        
        const dataFromClient = validationResult.data;
        const actorProfile = authResult.actorProfile;
        const dataOwnerId = authResult.dataOwnerId;

        const dataToUpdate: { [key: string]: any } = {
            ...dataFromClient,
            date: dataFromClient.date ? format(new Date(dataFromClient.date), 'yyyy-MM-dd') : undefined,
            updatedAt: new Date().toISOString(),
            updatedBy: decodedToken.uid,
            updatedByName: actorProfile.fullName || actorProfile.email || "User",
        };
        
        // Fetch company and work order names if their IDs have changed
        if (dataFromClient.companyId && dataFromClient.companyId !== authResult.expenseData.companyId) {
            const companyDoc = await adminDb.collection('companies').doc(dataFromClient.companyId).get();
            dataToUpdate.companyName = companyDoc.exists ? (companyDoc.data() as Company).name : null;
        } else if (dataFromClient.companyId === null) {
            dataToUpdate.companyName = null;
        }
        
        if (dataFromClient.workOrderId && dataFromClient.workOrderId !== authResult.expenseData.workOrderId) {
            const woDoc = await adminDb.collection('workOrders').doc(dataFromClient.workOrderId).get();
            dataToUpdate.workOrderNumber = woDoc.exists ? (woDoc.data() as WorkOrder).workOrderNumber : null;
        } else if (dataFromClient.workOrderId === null) {
            dataToUpdate.workOrderNumber = null;
        }
        
        Object.keys(dataToUpdate).forEach(key => dataToUpdate[key] === undefined && delete dataToUpdate[key]);

        const docRef = adminDb.collection('expenses').doc(expenseId);
        await docRef.update(dataToUpdate);

        await logActivity({
            ownerId: dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: actorProfile.fullName || "User",
            actionType: 'update',
            entityType: 'Expense',
            entityId: expenseId,
            details: `Updated expense: ${dataToUpdate.description || authResult.expenseData.description}`
        });

        const updatedDoc = await docRef.get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (error: any) {
        console.error(`API /api/expenses/[${expenseId}] PUT error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const expenseId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const authResult = await authorizeAccess(expenseId, decodedToken.uid);
        if (!authResult.authorized || !authResult.expenseData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        await adminDb.collection('expenses').doc(expenseId).delete();
        
        await logActivity({
            ownerId: authResult.dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: authResult.actorProfile.fullName || "User",
            actionType: 'delete',
            entityType: 'Expense',
            entityId: expenseId,
            entityName: authResult.expenseData.description
        });
        
        return NextResponse.json({ message: 'Expense deleted successfully.' }, { status: 200 });
    } catch (error: any) {
        console.error(`API /api/expenses/[${expenseId}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
