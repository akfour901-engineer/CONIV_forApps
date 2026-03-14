export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { EmailLog, UserProfile } from '@/types/server-only';



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
    if (!userProfileDoc.exists || !userProfileDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: User is not an administrator' }, { status: 403 });
    }

    const snapshot = await adminDb.collection('emailLogs').orderBy('timestamp', 'desc').limit(500).get();
    const emailLogs: EmailLog[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailLog));
    
    return NextResponse.json(emailLogs, { status: 200 });

  } catch (error: any) {
    console.error("API /admin/email-logs GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
