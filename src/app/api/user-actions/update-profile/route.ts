import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const profileUpdateSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters.").max(100),
  email: z.string().email("Invalid email format."),
  phoneNumber: z.string().optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  profilePicture: z.string().optional().nullable(),
  eSignature: z.string().optional().nullable(),
  signaturePhrase1: z.string().max(100).optional().nullable(),
  signaturePhrase2: z.string().max(100).optional().nullable(),
});

export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = profileUpdateSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json({ success: false, message: 'Invalid input.', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { email, ...dataToUpdate } = validationResult.data;

    // Email should not be updatable directly from this form
    if (email !== decodedToken.email) {
      console.warn(`Attempt to change email from ${decodedToken.email} to ${email} for user ${uid} was blocked.`);
    }

    const userDocRef = adminDb.collection('users').doc(uid);
    await userDocRef.update({
      ...dataToUpdate,
      updatedAt: new Date().toISOString(),
    });
    
    await logActivity({
        ownerId: uid,
        actorUid: uid,
        actorName: dataToUpdate.fullName || 'User',
        actionType: 'profile_update',
        entityType: 'UserProfile',
        entityId: uid,
        entityName: 'User Profile',
        details: 'User updated their profile information.'
    });

    const updatedDocSnap = await userDocRef.get();
    return NextResponse.json({
        success: true,
        message: 'Profile updated successfully.',
        userProfile: { uid: updatedDocSnap.id, ...updatedDocSnap.data() },
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in update-profile API:", error);
    return NextResponse.json({ success: false, message: error.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}
