import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin-init';
import { runLaborAnalysis, type LaborAnalysisInput } from '@/ai/flows/analyze-labor-flow';

export async function POST(request: Request) {
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);

    const input: LaborAnalysisInput = await request.json();

    if (decodedToken.uid !== input.actorUid) {
      return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }

    const result = await runLaborAnalysis(input);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`Error in /api/ai/analyze-labor:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = error.code || 500;
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status });
  }
}
