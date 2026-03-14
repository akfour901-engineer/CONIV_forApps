
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { Letter, UserProfile, TeamMember } from '@/types';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const letterUpdateSchema = z.object({
  documentType: z.enum(['Letter', 'Certificate']).optional(),
  recipient: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  context: z.string().min(10).max(2000).optional(),
  customFields: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  generatedTitle: z.string().optional().nullable(),
  generatedContent: z.string().optional().nullable(),
});

async function authorizeAccess(letterId: string, actorUid: string): Promise<{ authorized: boolean; letter?: Letter, dataOwnerId?: string }> {
    const adminDb = getDb();
    const docRef = adminDb.collection('letters').doc(letterId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return { authorized: false };

    const letter = { id: docSnap.id, ...docSnap.data() } as Letter;
    const dataOwnerId = letter.userId;
    
    if (actorUid === dataOwnerId) return { authorized: true, letter, dataOwnerId };

    const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(actorUid).get();
    // Allow any active team member to access this feature, as specific permission was removed.
    return { authorized: teamMemberDoc.exists, letter, dataOwnerId };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const { authorized, letter } = await authorizeAccess(params.id, decodedToken.uid);

        if (!authorized || !letter) return NextResponse.json({ error: 'Forbidden or Not Found' }, { status: 403 });
        
        return NextResponse.json(letter, { status: 200 });
    } catch (error: any) {
        console.error(`API /api/letters/[${params.id}] GET error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const adminDb = getDb();
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        const { authorized } = await authorizeAccess(params.id, decodedToken.uid);
        if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const requestBody = await request.json();
        const validationResult = letterUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });

        const dataToUpdate = { ...validationResult.data, updatedAt: new Date().toISOString(), updatedBy: decodedToken.uid };

        await adminDb.collection('letters').doc(params.id).update(dataToUpdate);
        
        const updatedDoc = await adminDb.collection('letters').doc(params.id).get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (error: any) {
        console.error(`API /api/letters/[${params.id}] PUT error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const adminDb = getDb();
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        const { authorized } = await authorizeAccess(params.id, decodedToken.uid);
        if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        
        await adminDb.collection('letters').doc(params.id).delete();
        
        return NextResponse.json({ message: 'Letter deleted successfully' }, { status: 200 });

    } catch (error: any) {
        console.error(`API /api/letters/[${params.id}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
