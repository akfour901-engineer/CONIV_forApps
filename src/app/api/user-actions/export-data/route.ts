
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/firebase-admin-init';
import { exportUserData, type ExportDataOutput, type ExportDataInput } from '@/ai/flows/export-user-data-flow';

export const dynamic = 'force-dynamic';
const exportRequestSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

export async function POST(request: Request) {
  const authAdmin = getAuth();
  const functionCallId = `api_export_data_POST_${Date.now()}`;
  
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
      return NextResponse.json({ error: 'Unauthorized: Invalid token', code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = exportRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { format } = validationResult.data;
    
    const flowInput: ExportDataInput = {
        userId: authenticatedUserUid,
        format: format,
    };

    const result: ExportDataOutput = await exportUserData(flowInput);

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/user-actions/export-data:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
