import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import { getDailyBriefing, type GetDailyBriefingOutput } from '@/ai/flows/daily-briefing-flow';
import type { UserProfile } from '@/types/server-only';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const authAdmin = getAuth();
    const adminDb = getDb();
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const { userId } = await request.json();

    if (decodedToken.uid !== userId) {
      const userProfileSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
      if (!userProfileSnap.exists) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const userProfile = userProfileSnap.data() as UserProfile;
      if (userProfile.ownerId !== userId) {
         return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const result: GetDailyBriefingOutput = await getDailyBriefing({ userId });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`[API] Daily Briefing Error:`, error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
