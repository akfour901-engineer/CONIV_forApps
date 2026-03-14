import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin-init';
import { runExpenseAnomalyAnalysis } from '@/ai/flows/expense-anomaly-flow';
import type { ExpenseAnomalyInput } from '@/ai/flows/expense-anomaly-flow';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const authAdmin = getAuth();
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);

    const input: ExpenseAnomalyInput = await request.json();

    if (decodedToken.uid !== input.actorUid) {
      return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }

    const result = await runExpenseAnomalyAnalysis(input);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`Error in /api/ai/expense-anomaly-detection:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
