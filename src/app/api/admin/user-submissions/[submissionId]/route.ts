export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserSubmission, UserProfile } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';

const submissionUpdateSchema = z.object({
  status: z.string().optional(),
  adminReplyMessage: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
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

export async function PUT(request: Request, { params }: { params: { submissionId: string } }) {
  const submissionId = params.submissionId;
  const adminDb = getDb();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    const adminCheck = await verifyAdminAndGetProfile(idToken);
    if (!adminCheck.isAdmin || !adminCheck.userProfile) return adminCheck.error!;

    const requestBody = await request.json();
    const validationResult = submissionUpdateSchema.safeParse(requestBody);
    if(!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataToUpdate = validationResult.data;
    if (Object.keys(dataToUpdate).length === 0) {
        return NextResponse.json({ error: 'No data provided for update.' }, { status: 400 });
    }
    
    const docRef = adminDb.collection('userSubmissions').doc(submissionId);
    
    const updatePayload: { [key: string]: any } = {
        ...dataToUpdate,
        updatedAt: new Date().toISOString(),
    };
    
    if (dataToUpdate.adminReplyMessage !== undefined) {
        updatePayload.adminRepliedAt = new Date().toISOString();
        updatePayload.adminRepliedByName = adminCheck.userProfile.fullName || adminCheck.userProfile.email;
        updatePayload.status = dataToUpdate.status || 'Awaiting User Response';
    }
    
    if (dataToUpdate.status && (dataToUpdate.status === 'Resolved' || dataToUpdate.status === 'Closed')) {
      updatePayload.resolvedAt = new Date().toISOString();
      updatePayload.resolvedBy = adminCheck.userProfile.fullName || adminCheck.userProfile.email;
    }

    await docRef.update(updatePayload);

    await logActivity({
        ownerId: (await docRef.get()).data()?.userId,
        actorUid: adminCheck.userProfile.uid,
        actorName: adminCheck.userProfile.fullName || "Admin",
        actionType: 'update',
        entityType: 'UserSubmission',
        entityId: submissionId,
        details: `Updated submission: Status to ${updatePayload.status || 'unchanged'}, replied: ${!!updatePayload.adminReplyMessage}`
    });

    const updatedDoc = await docRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /admin/user-submissions/[${submissionId}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
