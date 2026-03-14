

import { NextRequest, NextResponse } from 'next/server';
import { generateDocument } from '@/ai/flows/generate-document-flow';
import { DocumentGenerationInputSchema } from '@/types/server-only';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin-init';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    
    const body = await req.json();
    const validationResult = DocumentGenerationInputSchema.safeParse({ ...body, userId });
    
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const output = await generateDocument(validationResult.data);

    if ('error' in output && output.error) {
      return NextResponse.json({ error: output.error }, { status: 500 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error: any) {
    console.error('API Error in /api/letters/generate:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
