export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, MailingListEntry } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';

const entryUpdateSchema = z.object({
  name: z.string().max(100).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  status: z.enum(['manual_entry', 'signed_up', 'contacted', 'not_interested']).optional(),
  notes: z.string().max(1000).optional().nullable(),
}).partial();

async function verifyAdminAndGetProfile(idToken: string): Promise<{ isAdmin: boolean; userProfile?: UserProfile; error?: NextResponse }> {
  const authAdmin = getAuth();
  const adminDb = getDb();
  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (error: any) {
    return { isAdmin: false, error: NextResponse.json({ error: 'Unauthorized: Invalid token', code: error.code }, { status: 401 }) };
  }

  const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
  
  if (!userProfileDoc.exists) {
    return { isAdmin: false, error: NextResponse.json({ error: 'Forbidden: Admin user profile not found' }, { status: 403 }) };
  }
  const userProfileData = { uid: userProfileDoc.id, ...userProfileDoc.data() } as UserProfile;
  if (!userProfileData.isAdmin) {
    return { isAdmin: false, error: NextResponse.json({ error: 'Forbidden: User is not an administrator' }, { status: 403 }) };
  }
  return { isAdmin: true, userProfile: userProfileData };
}



export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminDb = getDb();
  const { id: entryId } = await params;

  try {
    const authorizationHeader = request.headers.get("Authorization");
    if (!authorizationHeader)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const idToken = authorizationHeader.split("Bearer ")[1];

    const adminCheck = await verifyAdminAndGetProfile(idToken);
    if (!adminCheck.isAdmin || !adminCheck.userProfile)
      return adminCheck.error!;

    const requestBody = await request.json();

    const validationResult = entryUpdateSchema.safeParse(requestBody);
    if (!validationResult.success)
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );

    const dataToUpdate = validationResult.data;

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json(
        { error: "No data provided for update." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("mailingList").doc(entryId);

    const updatePayload = {
      ...dataToUpdate,
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(updatePayload);

    await logActivity({
      ownerId: adminCheck.userProfile.uid,
      actorUid: adminCheck.userProfile.uid,
      actorName: adminCheck.userProfile.fullName || "Admin",
      actionType: "update",
      entityType: "MailingListEntry",
      entityId: entryId,
      details: `Updated mailing list entry for ${entryId}.`,
    });

    const updatedDoc = await docRef.get();

    return NextResponse.json(
      { id: updatedDoc.id, ...updatedDoc.data() },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`API /admin/mailing-list/[${entryId}] PUT error:`, error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const adminDb = getDb();
    const entryId = params.id;
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        
        const adminCheck = await verifyAdminAndGetProfile(idToken);
        if (!adminCheck.isAdmin || !adminCheck.userProfile) return adminCheck.error!;

        const docRef = adminDb.collection('mailingList').doc(entryId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Mailing list entry not found.' }, { status: 404 });
        }

        await docRef.delete();

        await logActivity({
            ownerId: adminCheck.userProfile.uid,
            actorUid: adminCheck.userProfile.uid,
            actorName: adminCheck.userProfile.fullName || "Admin",
            actionType: 'delete',
            entityType: 'MailingListEntry',
            entityId: entryId,
        });

        return NextResponse.json({ message: 'Entry deleted successfully' }, { status: 200 });

    } catch (error: any) {
        console.error(`API /admin/mailing-list/[${entryId}] DELETE error:`, error);
        return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
    }
}
