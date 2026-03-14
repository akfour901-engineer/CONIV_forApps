import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const functionCallId = `api_daily_checkin_POST_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;

    const userDocRef = adminDb.collection('users').doc(authenticatedUserUid);
    const userSnap = await userDocRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const userProfile = userSnap.data() as UserProfile;
    
    // A user can only claim a daily check-in for their own account.
    // This is handled by using authenticatedUserUid to fetch and update the document.

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    const lastCheckInDate = userProfile.lastCheckInDate ? new Date(userProfile.lastCheckInDate) : null;
    if(lastCheckInDate) {
        lastCheckInDate.setHours(0,0,0,0);
    }

    if (lastCheckInDate && lastCheckInDate.getTime() === today.getTime()) {
      return NextResponse.json({ error: 'Daily reward already claimed today.' }, { status: 409 });
    }
    
    let actualReward = 0;
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            // Use a default of 0 if not found
            const costConfig = configData.actionCosts?.find(c => c.key === "DAILY_CHECK_IN_REWARD");
            if (costConfig && typeof costConfig.cost === 'number') {
                actualReward = costConfig.cost;
            } else {
                 throw new Error("DAILY_CHECK_IN_REWARD cost is not configured in admin panel.");
            }
        } else {
            throw new Error("App configuration not found. Cannot determine daily reward.");
        }
    } catch (configError: any) { 
        console.error(`[${functionCallId}] API /daily-check-in POST: Error fetching reward amount.`, configError);
        return NextResponse.json({ error: 'Server configuration error for daily rewards.', details: configError.message }, { status: 500 });
    }


    const newResourcePoints = (userProfile.resourcePoints ?? 0) + actualReward;

    await userDocRef.update({
      resourcePoints: newResourcePoints,
      lastCheckInDate: today.toISOString().split('T')[0], // Store as YYYY-MM-DD string
      resourcePointsLastUpdated: new Date().toISOString(),
    });

    await logActivity({
        ownerId: authenticatedUserUid, // The owner is the one getting points
        actorUid: authenticatedUserUid, // The owner performed the action
        actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'daily_check_in_reward',
        entityType: 'UserProfile',
        entityId: authenticatedUserUid,
        entityName: 'Daily Check-in',
        details: { message: `Claimed ${actualReward} points for daily check-in.`, pointsAwarded: actualReward }
    });

    return NextResponse.json({ success: true, newResourcePoints, message: `Successfully claimed ${actualReward} points.` });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error in /api/user-actions/daily-check-in:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
