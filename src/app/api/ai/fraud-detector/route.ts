
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin-init';
import { runFraudAnalysis, type FraudAnalysisInput } from '@/ai/flows/fraud-detector-flow';
import type { FraudAnalysisOutput } from '@/types/server-only';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const authAdmin = getAuth();
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);

    const input: FraudAnalysisInput = await request.json();

    // Security check: Ensure the actor UID from the token matches the one in the payload
    if (decodedToken.uid !== input.actorUid) {
      return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }

    const result: FraudAnalysisOutput = await runFraudAnalysis(input);
    
    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`Error in /api/ai/detect-fraud:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
