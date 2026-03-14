import { NextResponse } from 'next/server';
import { generateDocument, type DocumentGenerationInput, type DocumentGenerationOutput } from '@/ai/flows/generate-document-flow';
import { getAuth } from '@/lib/firebase-admin-init';
import { DocumentGenerationInputSchema } from '@/types/server-only';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
    try {
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(idToken);

        const requestBody = await request.json();
        const validationResult = DocumentGenerationInputSchema.safeParse(requestBody);
        if (!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
        }

        const result: DocumentGenerationOutput = await generateDocument(validationResult.data);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('API /api/letters/generate error:', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred during document generation.' }, { status: 500 });
    }
}
