import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { exportUserData, type ExportDataInput } from '@/ai/flows/export-user-data-flow';
export const dynamic = 'force-dynamic';
const privacyRequestSchema = z.object({
  requestType: z.enum(['export', 'delete']),
  format: z.enum(['json', 'csv']).default('json').optional(), // Only used for export
});

export async function POST(request: Request) {
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
    const validationResult = privacyRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request type', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { requestType, format } = validationResult.data;
    
    const userProfileSnap = await adminDb.collection('users').doc(uid).get();
    if (!userProfileSnap.exists) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    const userProfile = userProfileSnap.data() as UserProfile;

    if (requestType === 'export') {
      const flowInput: ExportDataInput = { userId: uid, format: format || 'json' };
      const result = await exportUserData(flowInput);
      await logActivity({
        ownerId: uid,
        actorUid: uid,
        actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'data_export_requested',
        entityType: 'UserProfile',
        entityId: uid,
        entityName: 'Data Export',
        details: `User requested a full export of their data in ${format} format.`
      });
      return NextResponse.json(result, { status: 200 });

    } else if (requestType === 'delete') {
      await logActivity({
        ownerId: uid,
        actorUid: uid,
        actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'account_deletion_requested',
        entityType: 'UserProfile',
        entityId: uid,
        entityName: 'Account Deletion',
        details: 'User requested to permanently delete their account.'
      });
       return NextResponse.json({ message: "Account deletion request logged successfully. Check your email for confirmation." }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid request type specified.' }, { status: 400 });

  } catch (error: any) {
    console.error("API Error - Data Privacy Request:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
