import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { BankAccount, UserProfile, TeamMember } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const bankAccountUpdateSchema = z.object({
  accountHolderName: z.string().min(2, "Account holder name is required.").max(100).optional(),
  accountNumber: z.string().min(5, "Account number is required.").max(20).optional(),
  bankName: z.string().min(2, "Bank name is required.").max(100).optional(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format.").optional(),
  accountType: z.enum(['savings', 'current', 'other']).optional(),
  isDefault: z.boolean().optional(),
  companyId: z.string().optional().nullable(),
}).partial();


async function authorizeAccess(
  accountId: string, 
  authenticatedUserUid: string
): Promise<{ authorized: boolean; accountData?: BankAccount; dataOwnerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
  
  const adminDb = getDb();
  const accountDocRef = adminDb.collection('bankAccounts').doc(accountId);
  const accountSnap = await accountDocRef.get();

  if (!accountSnap.exists) {
    return { authorized: false, error: 'Bank Account not found', status: 404 };
  }
  const accountData = { id: accountSnap.id, ...accountSnap.data() } as BankAccount;
  const itemOwnerId = accountData.userId;

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) {
    return { authorized: false, error: 'Forbidden: Authenticated user profile not found.', status: 403 };
  }
  const actorProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  const actorDataOwnerContext = actorProfile.ownerId || actorProfile.uid;
  
  // Case 1: The user is the direct owner of the item and is acting on their own account.
  if (actorProfile.uid === itemOwnerId) {
    return { authorized: true, accountData, dataOwnerId: itemOwnerId, actorProfile };
  }

  // Case 2: The user is a team member, and the item belongs to their team owner.
  if (actorProfile.ownerId && actorProfile.ownerId === itemOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.canManageBankAccounts) {
        return { authorized: true, accountData, dataOwnerId: itemOwnerId, actorProfile };
      }
    }
  }

  // If neither case matches, deny access.
  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { accountId: string } }) {
  const accountId = params.accountId;
  try {
    const authAdmin = getAuth();
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);

    const authResult = await authorizeAccess(accountId, decodedToken.uid);
    if (!authResult.authorized || !authResult.accountData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.accountData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/bank-accounts/[${accountId}] GET error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { accountId: string } }) {
    const accountId = params.accountId;
    try {
        const adminDb = getDb();
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        const authResult = await authorizeAccess(accountId, decodedToken.uid);
        if (!authResult.authorized || !authResult.accountData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const requestBody = await request.json();
        const validationResult = bankAccountUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
        }
        
        const dataFromClient = validationResult.data;
        const actorProfile = authResult.actorProfile;

        const now = new Date().toISOString();
        const dataToUpdate: Partial<BankAccount> & { updatedAt: string, updatedBy: string, updatedByName: string } = {
            ...dataFromClient,
            updatedAt: now,
            updatedBy: decodedToken.uid,
            updatedByName: actorProfile.fullName || actorProfile.email || "User",
        };

        const batch = adminDb.batch();
        const accountDocRef = adminDb.collection('bankAccounts').doc(accountId);

        if (dataFromClient.isDefault === true) {
            const defaultQuery = adminDb.collection('bankAccounts')
                .where('userId', '==', authResult.dataOwnerId)
                .where('isDefault', '==', true);
            const defaultSnapshot = await defaultQuery.get();
            defaultSnapshot.forEach(docSnap => {
                if (docSnap.id !== accountId) {
                    batch.update(docSnap.ref, { isDefault: false });
                }
            });
        }
        
        batch.update(accountDocRef, dataToUpdate);
        await batch.commit();
        
        await logActivity({
            ownerId: authResult.dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: actorProfile.fullName || actorProfile.email || "User",
            actionType: 'update',
            entityType: 'BankAccount',
            entityId: accountId,
            entityName: `${dataToUpdate.bankName || authResult.accountData.bankName} - ...${dataToUpdate.accountNumber?.slice(-4) || authResult.accountData.accountNumber.slice(-4)}`,
            details: `Bank account updated.`
        });

        const updatedDoc = await accountDocRef.get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (error: any) {
        console.error(`API /api/bank-accounts/[${accountId}] PUT error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { accountId: string } }) {
    const accountId = params.accountId;
    try {
        const adminDb = getDb();
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        const authResult = await authorizeAccess(accountId, decodedToken.uid);
        if (!authResult.authorized || !authResult.accountData || !authResult.dataOwnerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        await adminDb.collection('bankAccounts').doc(accountId).delete();

        await logActivity({
            ownerId: authResult.dataOwnerId,
            actorUid: decodedToken.uid,
            actorName: authResult.actorProfile.fullName || "User",
            actionType: 'delete',
            entityType: 'BankAccount',
            entityId: accountId,
            entityName: authResult.accountData.bankName
        });
        
        return NextResponse.json({ message: 'Bank account deleted successfully.' }, { status: 200 });
    } catch (error: any) {
        console.error(`API /api/bank-accounts/[${accountId}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
