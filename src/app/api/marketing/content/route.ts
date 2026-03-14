


import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { MailingListContent } from '@/types';
import { GenerateMarketingContentInputSchema } from '@/types/server-only';
import type { GenerateMarketingContentOutput, GenerateMarketingContentInput } from '@/types/server-only';
import { generateMarketingContent } from '@/ai/flows/generate-marketing-content-flow';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const functionCallId = `api_generate_marketing_content_POST_${Date.now()}`;
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
    const validationResult = GenerateMarketingContentInputSchema.safeParse(requestBody);

    if(!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    
    // Security check: ensure the authenticated user is the one they claim to be acting for
    if(decodedToken.uid !== validationResult.data.userId) {
        // In a more complex app, you might check if the actor is a team member with permissions
        return NextResponse.json({ error: 'Forbidden: You can only generate content for your own account.' }, { status: 403 });
    }

    const result: GenerateMarketingContentOutput = await generateMarketingContent(validationResult.data);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/marketing/content:`, error);
    const errorMessage = (error as Error).message || 'An unexpected error occurred.';
    if (errorMessage.toLowerCase().includes('quota')) {
        return NextResponse.json({ error: 'AI quota exceeded. Please try again later.', code: 'QUOTA_EXCEEDED' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Internal server error', details: errorMessage, code: (error as any).code || 'UNKNOWN_SERVER_ERROR' }, { status: 500 });
  }
}

export async function GET(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        
        const url = new URL(request.url);
        const dataOwnerId = url.searchParams.get('dataOwnerId');
        if (!dataOwnerId) return NextResponse.json({ error: 'dataOwnerId is required' }, { status: 400 });

        if (decodedToken.uid !== dataOwnerId) {
             // In a real multi-tenant app, you'd check team permissions here
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const snapshot = await adminDb.collection('mailingListContent').where('userId', '==', dataOwnerId).get();
        let contents: MailingListContent[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailingListContent));
        
        // Perform sorting in code to avoid needing a composite index
        contents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(contents, { status: 200 });

    } catch (error: any) {
        console.error("API /marketing/content GET error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
