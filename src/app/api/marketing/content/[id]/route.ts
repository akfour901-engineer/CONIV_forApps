


import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { MailingListContent } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const contentUpdateSchema = z.object({
  contentName: z.string().min(3).optional(),
  subject: z.string().min(3).optional(),
  htmlContent: z.string().min(10).optional(),
});

async function authorizeAccess(contentId: string, actorUid: string): Promise<{ authorized: boolean; ownerId?: string; error?: string }> {
    const adminDb = getDb();
    const docSnap = await adminDb.collection('mailingListContent').doc(contentId).get();
    if (!docSnap.exists) return { authorized: false, error: "Content not found." };
    
    const contentData = docSnap.data() as MailingListContent;
    const ownerId = contentData.userId;

    if (actorUid === ownerId) return { authorized: true, ownerId };

    // Team member logic can be added here if needed
    
    return { authorized: false, error: "Access denied." };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        
        const { authorized, ownerId } = await authorizeAccess(params.id, decodedToken.uid);
        if (!authorized) return NextResponse.json({ error: ownerId }, { status: 403 });

        const docRef = await getDb().collection('mailingListContent').doc(params.id).get();
        return NextResponse.json({ id: docRef.id, ...docRef.data() }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const authAdmin = getAuth();
    const adminDb = getDb();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        
        const { authorized } = await authorizeAccess(params.id, decodedToken.uid);
        if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const requestBody = await request.json();
        const validationResult = contentUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });

        const dataToUpdate = { ...validationResult.data, updatedAt: new Date().toISOString() };
        await adminDb.collection('mailingListContent').doc(params.id).update(dataToUpdate);
        
        const updatedDoc = await adminDb.collection('mailingListContent').doc(params.id).get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const authAdmin = getAuth();
    const adminDb = getDb();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        
        const { authorized } = await authorizeAccess(params.id, decodedToken.uid);
        if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        await adminDb.collection('mailingListContent').doc(params.id).delete();
        
        return NextResponse.json({ message: 'Content deleted successfully.' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
