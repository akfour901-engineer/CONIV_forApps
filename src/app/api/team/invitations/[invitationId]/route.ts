



import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { TeamInvitation, UserProfile, TeamMember } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const updateStatusSchema = z.object({
  status: z.enum(['accepted', 'declined', 'cancelled']),
});

async function authorizeTeamInvitationAction(
    invitationId: string,
    authenticatedUserUid: string,
    action: 'cancel' | 'respond'
): Promise<{ 
    authorized: boolean; 
    invitationData?: TeamInvitation; 
    inviteeProfile?: UserProfile;
    actorProfile?: UserProfile;
    error?: string; 
    status?: number 
}> {
    const adminDb = getDb();
    const invitationRef = adminDb.collection('teamInvitations').doc(invitationId);
    const invitationSnap = await invitationRef.get();
    
    if (!invitationSnap.exists) { 
      return { authorized: false, error: 'Invitation not found', status: 404 };
    }
    const invitationData = { id: invitationSnap.id, ...invitationSnap.data() } as TeamInvitation;
    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if(!actorProfileDoc.exists) return { authorized: false, error: 'Actor user profile not found', status: 403 };
    const actorProfile = actorProfileDoc.data() as UserProfile;
    
    if (action === 'cancel') {
        let canCancel = false;
        if (invitationData.ownerId === authenticatedUserUid) canCancel = true;
        else if(actorProfile.ownerId === invitationData.ownerId) {
            const teamMemberDocRef = adminDb.collection('users').doc(invitationData.ownerId).collection('teamMembers').doc(authenticatedUserUid);
            const teamMemberDocSnap = await teamMemberDocRef.get();
            if(teamMemberDocSnap.exists && (teamMemberDocSnap.data() as TeamMember).permissions?.canManageTeam) {
                canCancel = true;
            }
        }
        if (!canCancel) {
            return { authorized: false, error: 'Forbidden: Only the owner or a supervisor can cancel this invitation.', status: 403 };
        }
        if (invitationData.status !== 'pending') {
             return { authorized: false, error: `Cannot cancel an invitation with status: ${invitationData.status}`, status: 400 };
        }
        return { authorized: true, invitationData, actorProfile };
    }

    if (action === 'respond') {
        const matchesEmail = invitationData.invitedEmail && invitationData.invitedEmail === actorProfile.email;
        const matchesPhone = invitationData.invitedPhoneNumber && invitationData.invitedPhoneNumber === actorProfile.phoneNumber;

        if (!matchesEmail && !matchesPhone) {
            return { authorized: false, error: 'Forbidden: This invitation is not for you.', status: 403 };
        }
        if (invitationData.status !== 'pending') {
             return { authorized: false, error: `Cannot respond to an invitation with status: ${invitationData.status}`, status: 400 };
        }
        return { authorized: true, invitationData, inviteeProfile: actorProfile, actorProfile };
    }
    return { authorized: false, error: 'Invalid action specified for authorization', status: 500 };
}

export async function PUT(request: Request, { params }: { params: { invitationId: string } }) {
  const invitationId = params.invitationId;
  const functionCallId = `api_invitation_PUT_${invitationId}_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = updateStatusSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input for status update', details: validationResult.error.flatten() }, { status: 400 });
    const { status: newStatus } = validationResult.data;

    const authActionType = newStatus === 'cancelled' ? 'cancel' : 'respond';
    const authResult = await authorizeTeamInvitationAction(invitationId, authenticatedUserUid, authActionType);

    if (!authResult.authorized || !authResult.invitationData || !authResult.actorProfile) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    const { invitationData, inviteeProfile, actorProfile } = authResult; 

    const batch = adminDb.batch();
    const invitationRef = adminDb.collection('teamInvitations').doc(invitationId);
    const now = new Date().toISOString();
    
    const actorName = actorProfile.fullName || actorProfile.email || "System User";

    batch.update(invitationRef, { 
        status: newStatus, 
        updatedAt: now, 
        acceptedByUid: newStatus === 'accepted' ? authenticatedUserUid : (invitationData.acceptedByUid || null),
        ...(newStatus === 'declined' && { acceptedByUid: null })
    });

    if (newStatus === 'accepted' && inviteeProfile) {
      const teamMemberRef = adminDb.collection('users').doc(invitationData.ownerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberData: Omit<TeamMember, 'id'> = {
        memberUid: authenticatedUserUid,
        name: inviteeProfile.fullName || invitationData.invitedMemberName || "Team Member",
        email: inviteeProfile.email!, 
        phoneNumber: inviteeProfile.phoneNumber || null, 
        permissions: invitationData.permissions,
        status: 'active',
        joinedAt: now,
        ownerName: invitationData.ownerName, 
        associatedWorkOrderId: invitationData.associatedWorkOrderId || null,
        associatedWorkOrderNumber: invitationData.associatedWorkOrderNumber || null,
        createdAt: now,
        createdByName: "System (On Invite Accept)",
        updatedAt: now,
        updatedBy: authenticatedUserUid, 
        updatedByName: actorName,
      };
      batch.set(teamMemberRef, teamMemberData);

      const inviteeProfileRef = adminDb.collection('users').doc(authenticatedUserUid);
      batch.update(inviteeProfileRef, { 
        ownerId: invitationData.ownerId, 
        teamMemberId: authenticatedUserUid, 
        updatedAt: now,
      });
    }
    
    await batch.commit();

    await logActivity({
      ownerId: invitationData.ownerId, 
      actorUid: authenticatedUserUid, 
      actorName,
      actionType: newStatus === 'accepted' ? 'invite_accepted' : newStatus === 'declined' ? 'invite_declined' : 'invite_cancelled',
      entityType: 'TeamInvitation', 
      entityId: invitationId, 
      entityName: invitationData.invitedMemberName,
      details: `Invitation status changed to ${newStatus}.`
    });

    const updatedInvitationSnap = await invitationRef.get();
    const updatedData = { id: updatedInvitationSnap.id, ...updatedInvitationSnap.data() };

    if (newStatus === 'accepted') {
        return NextResponse.json({ ...updatedData, permissions: invitationData.permissions }, { status: 200 });
    }

    return NextResponse.json(updatedData, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/team/invitations/[${invitationId}] PUT error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR_INVITE_PUT' }, { status: 500 });
  }
}
