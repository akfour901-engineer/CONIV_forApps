import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { EmailLog, UserProfile } from '@/types/server-only';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userProfileDoc.exists) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    const userProfile = userProfileDoc.data() as UserProfile;
    const userEmail = userProfile.email;
    const userId = userProfile.uid;

    if (!userEmail && !userId) {
      return NextResponse.json({ error: 'User identifiers not found.' }, { status: 400 });
    }

    // Query for emails sent TO the user OR sent FROM the user's account
    const toUserQuery = adminDb.collection('emailLogs').where('to', '==', userEmail);
    const fromUserQuery = adminDb.collection('emailLogs').where('fromUserId', '==', userId);

    const [toSnapshot, fromSnapshot] = await Promise.all([
        toUserQuery.get(),
        fromUserQuery.get()
    ]);
      
    const emailLogsMap = new Map<string, EmailLog>();
    toSnapshot.docs.forEach(doc => emailLogsMap.set(doc.id, { id: doc.id, ...doc.data() } as EmailLog));
    fromSnapshot.docs.forEach(doc => {
        if(!emailLogsMap.has(doc.id)) {
            emailLogsMap.set(doc.id, { id: doc.id, ...doc.data() } as EmailLog);
        }
    });

    let emailLogs = Array.from(emailLogsMap.values());
    
    emailLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(emailLogs, { status: 200 });

  } catch (error: any) {
    console.error("API /email-logs GET error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
