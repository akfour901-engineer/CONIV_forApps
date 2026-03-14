import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin-init';
import { restylePortfolioFlow, type RestylePortfolioInput } from '@/ai/flows/restyle-portfolio-flow';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const RestyleApiInputSchema = z.object({
    portfolioId: z.string(),
    prompt: z.string(),
    userId: z.string(),
});

export async function POST(request: Request) {
    try {
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const actorUid = decodedToken.uid;

        const requestBody = await request.json();
        const validationResult = RestyleApiInputSchema.safeParse(requestBody);
        if(!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
        }
        
        const { userId, portfolioId, prompt } = validationResult.data;

        // Security check: an actor can only restyle a portfolio if they are the owner of the data context.
        if (actorUid !== userId) {
            // Further checks could be added here for team members with specific permissions.
            return NextResponse.json({ error: 'Forbidden: You can only restyle portfolios for your own account.' }, { status: 403 });
        }

        const flowInput: RestylePortfolioInput = {
            portfolioId,
            userId,
            prompt,
            actorUid,
            actorName: decodedToken.name || decodedToken.email || undefined,
        };

        const result = await restylePortfolioFlow(flowInput);

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('API /api/ai/restyle-portfolio Error:', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
