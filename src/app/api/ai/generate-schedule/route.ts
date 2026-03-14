import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import { generateSchedule } from '@/ai/flows/generate-schedule-flow';
import type { GenerateScheduleInput } from '@/types/server-only';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const functionCallId = `api_generate_schedule_POST_${Date.now()}`;
  try {
    const authAdmin = getAuth();
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
    
    const requestBody = await request.json();
    
    // Basic validation
    if (!requestBody.workOrderId || !requestBody.userId) {
        return NextResponse.json({ error: 'workOrderId and userId are required.' }, { status: 400 });
    }
    
    const input: GenerateScheduleInput = {
      workOrderId: requestBody.workOrderId,
      userId: requestBody.userId,
      actorUid: decodedToken.uid,
      actorName: decodedToken.name || decodedToken.email || 'User',
    };

    // Authorization check: Ensure the actor is the owner or an authorized team member.
    // This logic is handled inside the flow itself for better encapsulation.
    
    const result = await generateSchedule(input);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/ai/generate-schedule:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    if (errorMessage.toLowerCase().includes('quota')) {
        return NextResponse.json({ error: 'AI quota exceeded. Please try again later.', code: 'QUOTA_EXCEEDED' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Internal server error', details: errorMessage, code: (error as any).code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}
