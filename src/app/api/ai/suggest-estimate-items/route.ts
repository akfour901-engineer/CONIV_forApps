import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember } from '@/types/server-only';
import { suggestEstimateItems, type SuggestEstimateItemsInput } from '@/ai/flows/suggest-estimate-items-flow';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authAdmin = getAuth();
  const adminDb = getDb();
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
    
    const input: SuggestEstimateItemsInput = await request.json();
    const dataOwnerIdForRequest = input.userId;

    let canUseAI = false;
    if (authenticatedUserUid === dataOwnerIdForRequest) {
        canUseAI = true;
    } else {
        const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
        if (actorProfileDoc.exists && (actorProfileDoc.data() as UserProfile)?.ownerId === dataOwnerIdForRequest) {
            const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerIdForRequest).collection('teamMembers').doc(authenticatedUserUid).get();
            if (teamMemberDoc.exists && (teamMemberDoc.data() as TeamMember).permissions?.canUseAiEstimateGeneration) {
                canUseAI = true;
            }
        }
    }

    if (!canUseAI) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to use this feature.' }, { status: 403 });
    }

    const result = await suggestEstimateItems(input);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`Error in /api/suggest-estimate-items:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = (error as any).status || 500;
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status });
  }
}
