import { NextResponse } from 'next/server';
import { generateBranding } from '@/ai/flows/generate-branding-flow';
import { GenerateBrandingInputSchema } from '@/types/server-only';
import { getAuth } from '@/lib/firebase-admin-init';
import type { GenerateBrandingInput } from '@/ai/flows/generate-branding-flow';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const authAdmin = getAuth();
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch(e) {
        return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
    }
    
    const requestBody = await request.json();
    const validationResult = GenerateBrandingInputSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const input: GenerateBrandingInput = validationResult.data;

    // Ensure the authenticated user (actor) is the one initiating the request for their own data.
    if (decodedToken.uid !== input.actorUid) {
        return NextResponse.json({ error: 'Forbidden: Actor UID mismatch.' }, { status: 403 });
    }
    
    // Also ensure the data being acted upon belongs to the actor, unless they are a team member with perms (future enhancement)
    if (decodedToken.uid !== input.userId) {
        // Here you could add logic to check team membership and permissions if needed
        return NextResponse.json({ error: 'Forbidden: You can only generate branding for your own account.' }, { status: 403 });
    }


    const result = await generateBranding(input);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error(`Error in /api/ai/generate-branding:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
