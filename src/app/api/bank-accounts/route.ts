
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { BankAccount, UserProfile, TeamMember, AppConfiguration } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { BANK_ACCOUNT_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const bankAccountCreateSchema = z.object({
  accountHolderName: z.string().min(2, "Account holder name is required.").max(100),
  accountNumber: z.string().min(5, "Account number is required.").max(20),
  bankName: z.string().min(2, "Bank name is required.").max(100),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format."),
  accountType: z.enum(['savings', 'current', 'other'], { required_error: "Account type is required." }),
  isDefault: z.boolean().default(false),
  companyId: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1, "Data owner context is required."), // Explicitly require context
});

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    if (!requestedDataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true;
    } else {
      const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if (memberProfileDoc.exists) {
        const memberProfile = memberProfileDoc.data() as UserProfile;
        if (memberProfile.ownerId === requestedDataOwnerId) {
          const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
          const teamMemberDocSnap = await teamMemberDocRef.get();
          if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageBankAccounts) canAccess = true;
          }
        }
      }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    const accountsSnapshot = await adminDb.collection('bankAccounts')
      .where('userId', '==', requestedDataOwnerId)
      .orderBy('isDefault', 'desc')
      .orderBy('bankName', 'asc')
      .get();
    const accounts: BankAccount[] = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
    return NextResponse.json(accounts, { status: 200 });

  } catch (error: any) {
    console.error('API /api/bank-accounts GET error:', error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const functionCallId = `api_bank_accounts_POST_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = bankAccountCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...dataFromClient } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;
    
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) {
        canCreate = true;
    } else {
        const memberProfile = actorProfile;
        if(memberProfile.ownerId === dataOwnerId) {
            const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if (teamMemberDocSnap.exists) {
                const teamMemberData = teamMemberDocSnap.data() as TeamMember;
                if (teamMemberData.permissions?.canManageBankAccounts) canCreate = true;
            }
        }
    }
    
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create bank accounts for this context.' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_BANK_ACCOUNT_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = BANK_ACCOUNT_CREATION_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "BANK_ACCOUNT_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /bank-accounts POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const now = new Date().toISOString();
    const newAccountData: Omit<BankAccount, 'id'> = {
      userId: dataOwnerId, // Use the explicit dataOwnerId from the request
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      accountHolderName: dataFromClient.accountHolderName,
      accountNumber: dataFromClient.accountNumber,
      bankName: dataFromClient.bankName,
      ifscCode: dataFromClient.ifscCode,
      accountType: dataFromClient.accountType,
      isDefault: dataFromClient.isDefault,
      companyId: dataFromClient.companyId || null,
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };

    const batch = adminDb.batch();
    const newAccountRef = adminDb.collection('bankAccounts').doc();

    if (newAccountData.isDefault) {
      const defaultQuery = adminDb.collection('bankAccounts')
        .where('userId', '==', dataOwnerId)
        .where('isDefault', '==', true);
      const defaultSnapshot = await defaultQuery.get();
      defaultSnapshot.forEach(docSnap => {
        batch.update(docSnap.ref, { isDefault: false, updatedAt: now, updatedBy: authenticatedUserUid, updatedByName: actorProfile.fullName || actorProfile.email || "User" });
      });
    } else {
        const allAccountsQuery = adminDb.collection('bankAccounts')
            .where('userId', '==', dataOwnerId)
            .limit(1);
        const allAccountsSnapshot = await allAccountsQuery.get();
        if(allAccountsSnapshot.empty) {
            newAccountData.isDefault = true;
        }
    }
    
    batch.set(newAccountRef, newAccountData);

    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });

    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create', entityType: 'BankAccount', entityId: newAccountRef.id, entityName: `${newAccountData.bankName} - ${newAccountData.accountNumber.slice(-4)}`,
      details: { message: `Bank account ${newAccountData.accountHolderName} added.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newAccountRef.id, ...newAccountData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error(`API /api/bank-accounts POST error (${functionCallId}):`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
