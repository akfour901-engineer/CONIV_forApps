


import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import * as admin from 'firebase-admin';
import type { Letter, UserProfile, TeamMember } from '@/types';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const letterSchema = z.object({
  documentType: z.enum(['Letter', 'Certificate']),
  recipient: z.string().min(1),
  subject: z.string().min(1),
  context: z.string().min(1),
  customFields: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  generatedTitle: z.string().optional().nullable(),
  generatedContent: z.string().optional().nullable(),
  userId: z.string(),
});

async function canAccess(actorUid: string, dataOwnerId: string): Promise<boolean> {
    const adminDb = getDb();
    if (actorUid === dataOwnerId) return true;
    const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(actorUid).get();
    // Allow any active team member to access this feature, as specific permission was removed.
    return teamMemberDoc.exists;
}

export async function POST(request: Request) {
    try {
        const adminDb = getDb();
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const actorUid = decodedToken.uid;
        
        const requestBody = await request.json();
        const validationResult = letterSchema.safeParse(requestBody);
        if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
        
        const { userId: dataOwnerId, ...data } = validationResult.data;
        
        if (!(await canAccess(actorUid, dataOwnerId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        
        const now = new Date().toISOString();
        const newLetterData: Omit<Letter, 'id'> = { ...data, userId: dataOwnerId, createdAt: now, updatedAt: now, createdBy: actorUid, updatedBy: actorUid };
        
        const newLetterRef = await adminDb.collection('letters').add(newLetterData);
        
        return NextResponse.json({ id: newLetterRef.id, ...newLetterData }, { status: 201 });
    } catch (error: any) {
        console.error('API /api/letters POST error:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const adminDb = getDb();
        const authAdmin = getAuth();
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        
        const url = new URL(request.url);
        const dataOwnerId = url.searchParams.get('dataOwnerId');
        if (!dataOwnerId) return NextResponse.json({ error: 'dataOwnerId is required' }, { status: 400 });
        
        if (!(await canAccess(decodedToken.uid, dataOwnerId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const snapshot = await adminDb.collection('letters').where('userId', '==', dataOwnerId).get();
        const letters: Letter[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Letter));

        // Perform sorting in code to avoid composite index
        letters.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return NextResponse.json(letters, { status: 200 });
    } catch (error: any) {
        console.error('API /api/letters GET error:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
