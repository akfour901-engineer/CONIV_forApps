
'use server';

import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, AuditContractorActivitiesInput, AuditContractorActivitiesOutput } from '@/types/server-only';
import { runAudit } from '@/ai/flows/audit-contractor-activities-flow'; // Updated import
import { adminDb } from '@/lib/firebase-admin-init';


async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<{ authorized: boolean; error?: NextResponse }> {
    if (authenticatedUserUid === requestedDataOwnerId) {
        return { authorized: true };
    }

    const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!memberProfileDoc.exists) {
        return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.' }, { status: 403 }) };
    }
    const memberProfile = memberProfileDoc.data() as UserProfile;

    if (memberProfile.ownerId === requestedDataOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canRunAudits) {
                return { authorized: true };
            }
        }
    }
    
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Not authorized to run audits.' }, { status: 403 }) };
}


export async function POST(request: Request) {
  const functionCallId = `api_audit_POST_${Date.now()}`;
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
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;
    
    const requestBody: AuditContractorActivitiesInput = await request.json();
    const { userId: requestedDataOwnerId } = requestBody;

    if (!requestedDataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId (userId in body) is required' }, { status: 400 });
    }

    const authCheck = await checkPermissions(authenticatedUserUid, requestedDataOwnerId);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }
    
    const result: AuditContractorActivitiesOutput = await runAudit(requestBody); // Using imported function

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/audit:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = (error as any).status || 500;
    if (status === 429 || errorMessage.toLowerCase().includes('quota')) {
        return NextResponse.json({ error: errorMessage, code: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage, code: (error as any).code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
