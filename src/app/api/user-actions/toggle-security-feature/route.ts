import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, AppConfiguration } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const ToggleSecurityFeatureInputSchema = z.object({
  userId: z.string(),
  action: z.enum(['enable_pin', 'disable_pin', 'change_pin', 'reset_pin']),
  pin: z.string().optional().nullable(),
  currentPin: z.string().optional().nullable(),
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
        const authenticatedUserUid = decodedToken.uid;
        
        const requestBody = await request.json();
        const validationResult = ToggleSecurityFeatureInputSchema.safeParse(requestBody);

        if (!validationResult.success) {
            return NextResponse.json({ success: false, message: 'Invalid input.', details: validationResult.error.flatten() }, { status: 400 });
        }
        
        const { userId, action, pin, currentPin } = validationResult.data;

        if(authenticatedUserUid !== userId) {
            return NextResponse.json({ success: false, message: 'Forbidden: You can only change your own security settings.' }, { status: 403 });
        }

        const userDocRef = adminDb.collection('users').doc(userId);
        const userSnap = await userDocRef.get();

        if (!userSnap.exists) {
            return NextResponse.json({ success: false, message: 'User profile not found.' }, { status: 404 });
        }
        const userProfile = userSnap.data() as UserProfile;

        let cost = 0;
        const updatePayload: { [key: string]: any } = {};
        let logAction: 'pin_setup' | 'pin_disabled' | 'pin_changed' | 'pin_reset' = 'pin_setup';
        
        if (action === 'enable_pin') {
            if (!pin || !/^\d{4}$/.test(pin)) return NextResponse.json({ success: false, message: 'A 4-digit PIN is required.' }, { status: 400 });
            
            let actualCost = 0;
            try {
                const configDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
                const configSnap = await configDocRef.get();
                if (configSnap.exists) {
                    const configData = configSnap.data() as AppConfiguration;
                    // Use a default of 0 if not found
                    const costConfig = configData.actionCosts?.find(c => c.key === "PIN_SETUP_COST");
                    actualCost = costConfig?.cost ?? 0;
                }
            } catch(e: any) {
                console.warn(`Could not fetch cost config for PIN_SETUP_COST. Defaulting to 0.`);
                actualCost = 0;
            }
            cost = actualCost;

            updatePayload.isPinEnabled = true;
            updatePayload.appPin = pin;
            updatePayload.lastPinChangeDate = new Date().toISOString();
            logAction = 'pin_setup';
        } else if (action === 'disable_pin') {
            updatePayload.isPinEnabled = false;
            updatePayload.appPin = null;
            updatePayload.lastPinChangeDate = null;
            updatePayload.pinChangeDays = null;
            logAction = 'pin_disabled';
        } else if (action === 'change_pin') {
            if (!currentPin || userProfile.appPin !== currentPin) return NextResponse.json({ success: false, message: 'Incorrect current PIN provided.' }, { status: 403 });
            if (!pin || !/^\d{4}$/.test(pin)) return NextResponse.json({ success: false, message: 'A new 4-digit PIN is required.' }, { status: 400 });
            updatePayload.appPin = pin;
            updatePayload.lastPinChangeDate = new Date().toISOString();
            
            if (userProfile.pinChangeDays !== null && userProfile.pinChangeDays !== undefined) {
                 updatePayload.pinChangeDays = null;
            }
            logAction = 'pin_changed';
        } else if (action === 'reset_pin') {
            // Password re-authentication is handled client-side before this call.
            // This API call just sets the new PIN.
             if (!pin || !/^\d{4}$/.test(pin)) return NextResponse.json({ success: false, message: 'A new 4-digit PIN is required.' }, { status: 400 });
            updatePayload.appPin = pin;
            updatePayload.lastPinChangeDate = new Date().toISOString();
            if (userProfile.pinChangeDays !== null && userProfile.pinChangeDays !== undefined) {
                 updatePayload.pinChangeDays = null;
            }
            logAction = 'pin_reset';
        } else {
             return NextResponse.json({ success: false, message: 'Invalid action specified.' }, { status: 400 });
        }


        if (cost > 0) {
            const currentPoints = userProfile.resourcePoints ?? 0;
            if (currentPoints < cost) {
                return NextResponse.json({ success: false, message: `Insufficient resource points. You need ${cost}, but have ${currentPoints}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
            }
            updatePayload.resourcePoints = currentPoints - cost;
            updatePayload.resourcePointsLastUpdated = new Date().toISOString();
        }
        
        updatePayload.updatedAt = new Date().toISOString();
        
        await userDocRef.update(updatePayload);

        await logActivity({
          ownerId: userId, actorUid: userId, actorName: userProfile.fullName || userProfile.email || "User",
          actionType: logAction, entityType: 'UserProfile', entityId: userId, entityName: 'Security Settings',
          details: { message: `App PIN Lock was ${action.replace('_pin','').replace('_',' ')}.`, cost: (cost > 0) ? cost : undefined }
        });

        return NextResponse.json({
          success: true,
          message: `PIN Lock successfully ${action.includes('disable') ? 'disabled' : 'updated'}.`,
          newResourcePoints: updatePayload.resourcePoints,
        }, { status: 200 });

    } catch (error: any) {
        console.error("Error in toggleSecurityFeature API:", error);
        return NextResponse.json({ success: false, message: error.message || 'An unexpected server error occurred.' }, { status: 500 });
    }
}
