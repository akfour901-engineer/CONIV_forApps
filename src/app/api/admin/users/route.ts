import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile } from '@/types/server-only';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
      console.error('Token verification error in /api/admin/users GET:', error.code, error.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;
    
    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    
    if (!userProfileDoc.exists) {
      return NextResponse.json({ error: 'Forbidden: Admin user profile not found' }, { status: 403 });
    }
    
    const userProfile = userProfileDoc.data() as UserProfile;
    
    if (!userProfile.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: User is not an administrator' }, { status: 403 });
    }
    
    const usersSnapshot = await adminDb.collection('users').get();
    const usersList: UserProfile[] = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    
    return NextResponse.json(usersList, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/admin/users GET handler:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
