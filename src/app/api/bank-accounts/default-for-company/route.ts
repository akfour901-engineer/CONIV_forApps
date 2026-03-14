import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { BankAccount, UserProfile, TeamMember } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];

    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
      console.error("Token verification error:", error);
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const ownerId = url.searchParams.get('ownerId');

    if (!companyId || !ownerId) {
      return NextResponse.json({ error: 'Bad Request: companyId and ownerId query parameters are required' }, { status: 400 });
    }
    
    // --- Corrected Authorization Check ---
    let canAccess = false;
    // Case 1: The authenticated user is the owner of the data they are requesting.
    if (authenticatedUserUid === ownerId) {
      canAccess = true;
    } else {
      // Case 2: The authenticated user is a team member trying to access their owner's data.
      const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if (userProfileDoc.exists) {
        const userProfile = userProfileDoc.data() as UserProfile;
        // Ensure the team member belongs to the correct owner.
        if (userProfile.ownerId === ownerId) {
          const teamMemberDoc = await adminDb.collection('users').doc(ownerId).collection('teamMembers').doc(authenticatedUserUid).get();
          if(teamMemberDoc.exists) {
            // Any active team member can view this data for now.
            // More granular permissions could be added here if needed.
            canAccess = true;
          }
        }
      }
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden: Not authorized to access this data.' }, { status: 403 });
    }
    
    let accountToReturn: BankAccount | null = null;
    
    // Priority 1: Find an account marked as default for this specific company
    const companyDefaultQuery = adminDb.collection('bankAccounts')
      .where('userId', '==', ownerId)
      .where('companyId', '==', companyId)
      .where('isDefault', '==', true)
      .limit(1);
    let snapshot = await companyDefaultQuery.get();

    if (!snapshot.empty) {
      accountToReturn = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as BankAccount;
    } else {
      // Priority 2: Find a general default account for the user that is not tied to a company
      const userGeneralDefaultQuery = adminDb.collection('bankAccounts')
        .where('userId', '==', ownerId)
        .where('isDefault', '==', true)
        .where('companyId', '==', null)
        .limit(1);
      snapshot = await userGeneralDefaultQuery.get();
      if (!snapshot.empty) {
        accountToReturn = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as BankAccount;
      }
    }
    
    // Priority 3: Fallback to ANY account for that company if no default is found
    if (!accountToReturn) {
      const anyCompanyAccountQuery = adminDb.collection('bankAccounts')
        .where('userId', '==', ownerId)
        .where('companyId', '==', companyId)
        .limit(1);
      const anyCompanyAccountSnapshot = await anyCompanyAccountQuery.get();
      if (!anyCompanyAccountSnapshot.empty) {
        accountToReturn = { id: anyCompanyAccountSnapshot.docs[0].id, ...anyCompanyAccountSnapshot.docs[0].data() } as BankAccount;
      }
    }

    // Priority 4: Fallback to ANY account for the user if still no account is found
    if (!accountToReturn) {
      const anyAccountQuery = adminDb.collection('bankAccounts')
        .where('userId', '==', ownerId)
        .limit(1);
      const anyAccountSnapshot = await anyAccountQuery.get();
      if (!anyAccountSnapshot.empty) {
        accountToReturn = { id: anyAccountSnapshot.docs[0].id, ...anyAccountSnapshot.docs[0].data() } as BankAccount;
      }
    }
    
    if (accountToReturn) {
      return NextResponse.json(accountToReturn, { status: 200 });
    } else {
      return NextResponse.json({ error: 'No suitable bank account found.' }, { status: 404 });
    }

  } catch (error: any) {
    console.error(`API error in /api/bank-accounts/default-for-company:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
