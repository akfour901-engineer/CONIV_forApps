
'use server';

import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserSubmission, UserProfile } from '@/types/server-only';
import { z } from 'zod';
import { USER_SUBMISSION_TYPE_OPTIONS } from '@/types';
import { logActivity } from '@/lib/activityLog';

const submissionFormSchema = z.object({
  submissionType: z.enum(USER_SUBMISSION_TYPE_OPTIONS),
  subject: z.string().min(5, "Subject must be at least 5 characters.").max(150),
  description: z.string().min(20, "Description must be at least 20 characters.").max(2000),
  attachmentUrl: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token', code: error.code }, { status: 401 });
    }
    const uid = decodedToken.uid;
    const userProfileSnap = await adminDb.collection('users').doc(uid).get();
    if (!userProfileSnap.exists) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    const userProfile = userProfileSnap.data() as UserProfile;

    const requestBody = await request.json();
    const validationResult = submissionFormSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const submissionData = validationResult.data;
    const now = new Date().toISOString();

    const newSubmission: Omit<UserSubmission, 'id'> = {
      userId: uid,
      userName: userProfile.fullName || 'N/A',
      userEmail: userProfile.email || 'N/A',
      submissionType: submissionData.submissionType,
      subject: submissionData.subject,
      description: submissionData.description,
      status: 'New',
      attachmentUrl: submissionData.attachmentUrl || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const newDocRef = await adminDb.collection('userSubmissions').add(newSubmission);
    
    await logActivity({
      ownerId: uid,
      actorUid: uid,
      actorName: userProfile.fullName || userProfile.email || "User",
      actionType: 'create',
      entityType: 'UserSubmission',
      entityId: newDocRef.id,
      entityName: `Submission: ${submissionData.subject.substring(0, 50)}...`,
      details: 'User created a new support/feedback submission.'
    });
    
    return NextResponse.json({ success: true, id: newDocRef.id }, { status: 201 });

  } catch (error: any) {
    console.error("API /user-submissions POST error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function GET(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        
        let decodedToken;
        try {
            decodedToken = await authAdmin.verifyIdToken(idToken);
        } catch (error: any) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token', code: error.code }, { status: 401 });
        }
        
        const submissionsSnapshot = await adminDb.collection('userSubmissions')
            .where('userId', '==', decodedToken.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const submissions: UserSubmission[] = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserSubmission));
        
        return NextResponse.json(submissions, { status: 200 });

    } catch (error: any) {
        console.error("API /user-submissions GET error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
    }
}
