import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { Estimate, WorkOrder, AssessDocumentRiskInput, AssessDocumentRiskOutput, AppConfiguration, UserProfile, TeamMember } from '@/types/server-only';
import { AssessDocumentRiskInputSchema, AssessDocumentRiskOutputSchema } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { assessDocumentRiskFlow } from '@/ai/flows/assess-document-risk-flow';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const functionCallId = `api_assess_risk_POST_${Date.now()}`;
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

        const input: AssessDocumentRiskInput = await request.json();
        const dataOwnerIdForRequest = input.userId;

        // Authorization check
        let canUseAI = false;
        if (authenticatedUserUid === dataOwnerIdForRequest) {
            canUseAI = true; // Owner can always use
        } else {
            // Check if actor is a team member with permissions
            const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
            if (actorProfileDoc.exists && (actorProfileDoc.data() as UserProfile)?.ownerId === dataOwnerIdForRequest) {
                const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerIdForRequest).collection('teamMembers').doc(authenticatedUserUid).get();
                if (teamMemberDoc.exists && (teamMemberDoc.data() as TeamMember).permissions?.canUseAiRiskAssessment) {
                    canUseAI = true;
                }
            }
        }
        
        if (!canUseAI) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to use this feature.' }, { status: 403 });
        }
        
        const result = await assessDocumentRiskFlow(input);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error(`[${functionCallId}] Error in /api/assess-document-risk:`, error);
        const errorMessage = error.message || 'An unexpected error occurred.';
        const status = (error as any).status || 500;
        const isQuotaError = status === 429 || errorMessage.toLowerCase().includes('quota');
        if (isQuotaError) {
             return NextResponse.json({ error: errorMessage, code: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage, code: (error as any).code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
    }
}
