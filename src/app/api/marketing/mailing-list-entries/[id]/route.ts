

import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import type { MailingListEntry } from '@/types/server-only';
export const dynamic = 'force-dynamic';
const entryUpdateSchema = z.object({
  mailingListIds: z.array(z.string()).optional(),
  // Add other updatable fields here if needed in the future
}).partial();


export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    const contactId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(idToken);
        
        const requestBody = await request.json();
        const validationResult = entryUpdateSchema.safeParse(requestBody);
        if(!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });

        const dataToUpdate = {
            ...validationResult.data,
            updatedAt: new Date().toISOString(),
        };

        const docRef = adminDb.collection('mailingList').doc(contactId);
        await docRef.update(dataToUpdate);

        return NextResponse.json({ success: true, id: contactId, ...dataToUpdate });

    } catch (error: any) {
        console.error(`API /marketing/mailing-list-entries/[${contactId}] PUT error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    const contactId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(idToken);
        
        const docRef = adminDb.collection('mailingList').doc(contactId);
        await docRef.delete();

        return NextResponse.json({ success: true, message: "Contact deleted." });
    } catch (error: any) {
        console.error(`API /marketing/mailing-list-entries/[${contactId}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
