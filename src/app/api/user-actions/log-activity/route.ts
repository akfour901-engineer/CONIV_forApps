import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { ActivityLog, ActivityLogActionType, ActivityLogEntityType } from '@/types';
import { logActivity as serverLogActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const logSchema = z.object({
  actionType: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  details: z.union([z.string(), z.record(z.any())]).optional(),
});


export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid or expired token', code: error.code }, { status: 401 });
    }
    
    const requestBody = await request.json();
    const validationResult = logSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json({ success: false, error: 'Invalid log data provided', details: validationResult.error.flatten() }, { status: 400 });
    }
    const logData = validationResult.data;
    
    const userProfileSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userProfileSnap.exists) {
        return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
    }
    const userProfile = userProfileSnap.data()!;
    const ownerId = userProfile.ownerId || decodedToken.uid;

    await serverLogActivity({
      ownerId: ownerId,
      actorUid: decodedToken.uid,
      actorName: userProfile.fullName || userProfile.email || "User",
      actionType: logData.actionType as ActivityLogActionType,
      entityType: logData.entityType as ActivityLogEntityType,
      entityId: logData.entityId,
      entityName: logData.entityName,
      details: logData.details,
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error("API /log-activity error:", error);
    return NextResponse.json({ success: false, error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
