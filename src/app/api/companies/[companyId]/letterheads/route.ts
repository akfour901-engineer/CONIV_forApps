import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { UserProfile, TeamMember, Letterhead } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const letterheadCreateSchema = z.object({
  letterhead: z.object({
    name: z.string().min(1, "Name is required"),
    html: z.string().min(1, "HTML content is required"),
    css: z.string().min(1, "CSS content is required"),
  }),
});

async function authorizeCompanyAccess(
  companyId: string,
  authenticatedUserUid: string,
  adminDb: any
): Promise<{ authorized: boolean; ownerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
  
  const companyDocRef = adminDb.collection('companies').doc(companyId);
  const companySnap = await companyDocRef.get();
  if (!companySnap.exists) return { authorized: false, error: 'Company not found', status: 404 };

  const companyOwnerId = companySnap.data()!.userId;

  const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!actorProfileDoc.exists) return { authorized: false, error: 'Authenticated user profile not found.', status: 403 };
  const actorProfile = actorProfileDoc.data() as UserProfile;

  if (authenticatedUserUid === companyOwnerId) {
    return { authorized: true, ownerId: companyOwnerId, actorProfile };
  }

  if (actorProfile.ownerId === companyOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(companyOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const teamMemberData = teamMemberDocSnap.data() as TeamMember;
      // Allow viewing for most members, but creation/edit requires specific perms
      if (teamMemberData.permissions?.canManageCompanies || teamMemberData.permissions?.canViewEstimates || teamMemberData.permissions?.canViewInvoices) {
        return { authorized: true, ownerId: companyOwnerId, actorProfile };
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

        const letterheadsSnapshot = await adminDb.collection('companies').doc(companyId).collection('letterheads').orderBy('createdAt', 'desc').get();
        const letterheads: Letterhead[] = letterheadsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Letterhead, 'id'>)}));

        return NextResponse.json(letterheads, { status: 200 });

    } catch (error: any) {
        console.error("API /api/companies/[id]/letterheads GET error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}


export async function POST(request: Request, { params }: { params: { companyId: string } }) {
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
        if (!authResult.authorized || !authResult.ownerId || !authResult.actorProfile) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
        }

        const requestBody = await request.json();
        const validationResult = letterheadCreateSchema.safeParse(requestBody);
        if(!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
        }
        
        const { letterhead } = validationResult.data;
        const now = new Date().toISOString();

        const newLetterhead: Omit<Letterhead, 'id'> = {
            name: letterhead.name,
            html: letterhead.html,
            css: letterhead.css,
        };

        const letterheadRef = await adminDb.collection('companies').doc(companyId).collection('letterheads').add({ ...newLetterhead, createdAt: now });
        
        await logActivity({
            ownerId: authResult.ownerId,
            actorUid: authenticatedUserUid,
            actorName: authResult.actorProfile.fullName || authResult.actorProfile.email || "User",
            actionType: 'create',
            entityType: 'System',
            entityId: letterheadRef.id,
            entityName: letterhead.name,
            details: `Saved new letterhead style: "${letterhead.name}"`
        });

        return NextResponse.json({ id: letterheadRef.id, ...newLetterhead }, { status: 201 });

    } catch (error: any) {
        console.error("API /api/companies/[id]/letterheads POST error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
