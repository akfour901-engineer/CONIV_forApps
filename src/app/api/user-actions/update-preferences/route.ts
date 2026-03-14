import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration, UserNotificationPreferences } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const preferencesUpdateSchema = z.object({
  notifications: z.custom<UserNotificationPreferences>(),
  logActiveTime: z.boolean().optional(),
  passwordChangeDays: z.number().int().min(30).optional().nullable(),
  pinChangeDays: z.number().int().min(30).optional().nullable(),
});

export async function PUT(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = preferencesUpdateSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    }
    const { notifications, passwordChangeDays, pinChangeDays, logActiveTime } = validationResult.data;

    const userDocRef = adminDb.collection('users').doc(uid);
    const userProfileSnap = await userDocRef.get();
    if (!userProfileSnap.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    const userProfile = userProfileSnap.data() as UserProfile;

    const dataToUpdate: { [key: string]: any } = {
      notificationPreferences: notifications,
      updatedAt: new Date().toISOString(),
    };

    if (passwordChangeDays !== undefined) {
      dataToUpdate.passwordChangeDays = passwordChangeDays;
      if (passwordChangeDays !== null) {
          // If a new policy is set, immediately update last change date to start the timer
          dataToUpdate.lastPasswordChangeDate = new Date().toISOString();
      }
    }
    if (pinChangeDays !== undefined) {
      dataToUpdate.pinChangeDays = pinChangeDays;
        if (pinChangeDays !== null && userProfile.isPinEnabled) {
          dataToUpdate.lastPinChangeDate = new Date().toISOString();
      }
    }
    if (logActiveTime !== undefined) {
        dataToUpdate.logActiveTime = logActiveTime;
    }
    
    await userDocRef.update(dataToUpdate);

    await logActivity({
      ownerId: uid,
      actorUid: uid,
      actorName: userProfile.fullName || userProfile.email || "User",
      actionType: 'preferences_updated',
      entityType: 'UserProfile',
      entityId: uid,
      entityName: 'User Preferences',
      details: 'User updated their notification and security preferences.'
    });

    const updatedProfileData = { ...userProfile, ...dataToUpdate };

    return NextResponse.json({ data: updatedProfileData, message: "Preferences saved successfully." }, { status: 200 });

  } catch (error: any) {
    console.error("API Error - Update Preferences:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
