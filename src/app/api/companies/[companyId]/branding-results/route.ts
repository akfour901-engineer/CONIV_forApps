import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, TeamMember, GenerateBrandingOutput } from '@/types/server-only';
export const dynamic = 'force-dynamic';
async function authorizeCompanyAccess(
  companyId: string,
  authenticatedUserUid: string,
  adminDb: FirebaseFirestore.Firestore
): Promise<{ authorized: boolean; ownerId?: string; error?: string; status?: number }> {
  
  const companyDocRef = adminDb.collection('companies').doc(companyId);
  const companySnap = await companyDocRef.get();
  if (!companySnap.exists) return { authorized: false, error: 'Company not found', status: 404 };

  const companyOwnerId = companySnap.data()!.userId;

  const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!actorProfileDoc.exists) return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
  const actorProfile = actorProfileDoc.data() as UserProfile;

  if (authenticatedUserUid === companyOwnerId) {
    return { authorized: true, ownerId: companyOwnerId };
  }

  if (actorProfile.ownerId === companyOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(companyOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      if (teamMemberData.permissions?.canManageCompanies) {
        return { authorized: true, ownerId: companyOwnerId };
      }
    }
  }

  return { authorized: false, error: 'Forbidden: You do not have permission to access resources for this company.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { companyId: string } }) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;
        
        const companyId = params.companyId;
        const authResult = await authorizeCompanyAccess(companyId, authenticatedUserUid, adminDb);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const brandingResultsSnapshot = await adminDb.collection('companies').doc(companyId).collection('brandingResults').orderBy('createdAt', 'desc').limit(1).get();
        
        if (brandingResultsSnapshot.empty) {
            return NextResponse.json(null, { status: 200 }); // Return null instead of 404 if no results exist yet
        }
        
        const latestResult = brandingResultsSnapshot.docs[0].data() as Omit<GenerateBrandingOutput, 'newResourcePoints'>;

        return NextResponse.json(latestResult, { status: 200 });

    } catch (error: any) {
        console.error("API /api/companies/[id]/branding-results GET error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
