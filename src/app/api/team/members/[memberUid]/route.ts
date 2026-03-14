
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { TeamMember, TeamPermissions, UserProfile } from '@/types/server-only';
import { DEFAULT_TEAM_PERMISSIONS } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
export const dynamic = 'force-dynamic';
const permissionsUpdateSchema = z.object({
  permissions: z.custom<TeamPermissions>((val) => typeof val === 'object' && val !== null, {
    message: "Permissions must be a valid object.",
  }).default(DEFAULT_TEAM_PERMISSIONS),
});

async function authorizeTeamAction(
    authenticatedUserUid: string,
    memberUidFromPath: string,
    action: 'update_permissions' | 'remove_or_leave',
    adminDb: admin.firestore.Firestore
): Promise<{ 
    authorized: boolean; 
    operationType: 'owner_updating_permissions' | 'owner_removing_member' | 'member_leaving_team' | 'unknown'; 
    dataOwnerIdToActUpon?: string; 
    memberUidTargeted?: string; 
    actorProfile?: UserProfile; 
    targetMemberProfile?: UserProfile; 
    error?: string; 
    status?: number 
}> {
    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    
    if (!authUserProfileDoc.exists) {
        return { authorized: false, operationType: 'unknown', error: 'Authenticated user profile not found.', status: 403 };
    }
    const authUserProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;

    if (action === 'update_permissions') {
        if (authUserProfile.ownerId && authUserProfile.ownerId !== authenticatedUserUid) { // Actor is a team member
            return { authorized: false, operationType: 'unknown', actorProfile: authUserProfile, error: "Team members cannot update permissions.", status: 403 };
        }
        // Actor is an owner
        const targetMemberProfileDoc = await adminDb.collection('users').doc(memberUidFromPath).get();
        if (!targetMemberProfileDoc.exists) {
          return { authorized: false, operationType: 'unknown', actorProfile: authUserProfile, error: 'Target member profile for permission update not found.', status: 404 };
        }
        
        const teamMemberSubDocRef = adminDb.collection(`users/${authenticatedUserUid}/teamMembers`).doc(memberUidFromPath);
        const teamMemberSubDocSnap = await teamMemberSubDocRef.get();
        if (!teamMemberSubDocSnap.exists) {
          return { authorized: false, operationType: 'unknown', actorProfile: authUserProfile, error: 'Targeted user is not a member of your team for permission update.', status: 404 };
        }

        return {
            authorized: true,
            operationType: 'owner_updating_permissions',
            dataOwnerIdToActUpon: authenticatedUserUid, 
            memberUidTargeted: memberUidFromPath,
            actorProfile: authUserProfile,
            targetMemberProfile: { uid: targetMemberProfileDoc.id, ...targetMemberProfileDoc.data() } as UserProfile,
        };
    } else if (action === 'remove_or_leave') {
        if (authenticatedUserUid === memberUidFromPath) { // User is targeting themselves (leaving team)
            if (!authUserProfile.ownerId || authUserProfile.ownerId === authenticatedUserUid) { 
                return { authorized: false, operationType: 'unknown', actorProfile: authUserProfile, error: "Account owners cannot leave their own team this way; team members must have a distinct ownerId.", status: 400 };
            }
            return {
                authorized: true,
                operationType: 'member_leaving_team',
                dataOwnerIdToActUpon: authUserProfile.ownerId, 
                memberUidTargeted: authenticatedUserUid,      
                actorProfile: authUserProfile,                
            };
        } else { // Authenticated user is targeting another member (owner removing member)
            if (authUserProfile.ownerId && authUserProfile.ownerId !== authenticatedUserUid) { 
                return { authorized: false, operationType: 'unknown', actorProfile: authUserProfile, error: "Team members cannot remove other members.", status: 403 };
            }
            // Actor is an owner removing a member
            const targetMemberProfileDoc = await adminDb.collection('users').doc(memberUidFromPath).get();
            if (!targetMemberProfileDoc.exists) {
              return { authorized: false, operationType: 'unknown', actorProfile: authUserProfile, error: 'Target member profile for removal not found.', status: 404 };
            }
            
            const teamMemberSubDocRef = adminDb.collection(`users/${authenticatedUserUid}/teamMembers`).doc(memberUidFromPath);
            const teamMemberSubDocSnap = await teamMemberSubDocRef.get();
            if (!teamMemberSubDocSnap.exists) {
              return { authorized: false, operationType: 'unknown', actorProfile: authUserProfile, error: 'Targeted user is not a member of your team for removal.', status: 404 };
            }

            return {
                authorized: true,
                operationType: 'owner_removing_member',
                dataOwnerIdToActUpon: authenticatedUserUid, 
                memberUidTargeted: memberUidFromPath,     
                actorProfile: authUserProfile,            
                targetMemberProfile: { uid: targetMemberProfileDoc.id, ...targetMemberProfileDoc.data() } as UserProfile, 
            };
        }
    }
    return { authorized: false, operationType: 'unknown', error: 'Invalid action type specified for authorization.', status: 500 };
}


export async function DELETE(request: Request, { params }: { params: { memberUid: string } }) {
  const memberUidFromPath = params.memberUid;
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken); 
    const authenticatedUserUid = decodedToken.uid;
    
    const functionCallId = `api_member_DELETE_${memberUidFromPath}_${Date.now()}`;

    const authResult = await authorizeTeamAction(authenticatedUserUid, memberUidFromPath, 'remove_or_leave', adminDb);

    if (!authResult.authorized || !authResult.dataOwnerIdToActUpon || !authResult.memberUidTargeted || !authResult.actorProfile) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }

    const { operationType, dataOwnerIdToActUpon, memberUidTargeted, actorProfile, targetMemberProfile } = authResult;
    
    const memberUserProfileRef = adminDb.collection('users').doc(memberUidTargeted);
    const teamMemberDocRef = adminDb.collection(`users/${dataOwnerIdToActUpon}/teamMembers`).doc(memberUidTargeted);
    
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    if (operationType === 'member_leaving_team') {
        batch.update(teamMemberDocRef, { status: 'removed_by_self', updatedAt: now, updatedBy: actorProfile.uid, updatedByName: actorProfile.fullName || actorProfile.email });
        batch.update(memberUserProfileRef, { ownerId: admin.firestore.FieldValue.delete(), teamMemberId: admin.firestore.FieldValue.delete(), updatedAt: now });
    } else if (operationType === 'owner_removing_member') {
        batch.update(teamMemberDocRef, { status: 'removed_by_owner', updatedAt: now, updatedBy: actorProfile.uid, updatedByName: actorProfile.fullName || actorProfile.email });
        batch.update(memberUserProfileRef, { ownerId: admin.firestore.FieldValue.delete(), teamMemberId: admin.firestore.FieldValue.delete(), updatedAt: now });
    } else {
        return NextResponse.json({ error: 'Invalid operation type determined for DELETE.' }, { status: 500 });
    }
    
    const invitationsRef = adminDb.collection("teamInvitations");
    const acceptedInvitesQuery = invitationsRef
        .where("ownerId", "==", dataOwnerIdToActUpon)
        .where("acceptedByUid", "==", memberUidTargeted)
        .where("status", "==", "accepted");
    const acceptedInvitesSnap = await acceptedInvitesQuery.get();
    acceptedInvitesSnap.forEach(docSnap => {
        batch.update(docSnap.ref, { status: operationType === 'member_leaving_team' ? "revoked_member_left" : "revoked_by_owner", updatedAt: now });
    });

    await batch.commit();

    await logActivity({
      ownerId: dataOwnerIdToActUpon, 
      actorUid: actorProfile.uid,    
      actorName: actorProfile.fullName || actorProfile.email || "System",
      actionType: operationType === 'member_leaving_team' ? 'member_left_team' : 'member_removed',
      entityType: 'TeamMember',
      entityId: memberUidTargeted,
      entityName: (operationType === 'member_leaving_team' ? actorProfile.fullName : targetMemberProfile?.fullName) || memberUidTargeted,
      details: `Team member ${operationType === 'member_leaving_team' ? 'successfully left team' : 'removed by owner'}.`
    });

    return NextResponse.json({ message: `Team member ${operationType === 'member_leaving_team' ? 'successfully left team' : 'removed successfully'}` }, { status: 200 });

  } catch (error: any) {
    const pathUidForError = params?.memberUid || "UNKNOWN_MEMBER_UID_IN_PATH";
    const functionCallIdForError = `api_member_DELETE_ERROR_${pathUidForError}_${Date.now()}`;
    console.error(`[${functionCallIdForError}] API DELETE /api/team/members/[${pathUidForError}] error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR_MEMBER_DELETE' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { memberUid: string } }) {
  const memberUidFromPath = params.memberUid;
  const adminDb = getDb();
  
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken); 
    const authenticatedUserUid = decodedToken.uid; 

    const functionCallId = `api_member_PUT_${memberUidFromPath}_${Date.now()}`;

    const authResult = await authorizeTeamAction(authenticatedUserUid, memberUidFromPath, 'update_permissions', adminDb);
    
    if (!authResult.authorized || authResult.operationType !== 'owner_updating_permissions' || !authResult.actorProfile || !authResult.targetMemberProfile) {
        return NextResponse.json({ error: authResult.error || "Operation not permitted for permissions update." }, { status: authResult.status || 403 });
    }
    
    const { actorProfile, targetMemberProfile, dataOwnerIdToActUpon } = authResult;

    const requestBody = await request.json();
    const validationResult = permissionsUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input for permissions', details: validationResult.error.flatten() }, { status: 400 });

    const { permissions } = validationResult.data;
    const now = new Date().toISOString();
    
    const memberDocRef = adminDb.collection(`users/${dataOwnerIdToActUpon}/teamMembers`).doc(memberUidFromPath);

    await memberDocRef.update({
        permissions: permissions,
        updatedAt: now,
        updatedBy: authenticatedUserUid, 
        updatedByName: actorProfile.fullName || actorProfile.email || "Owner"
    });

    await logActivity({
      ownerId: dataOwnerIdToActUpon!, 
      actorUid: authenticatedUserUid, 
      actorName: actorProfile.fullName || actorProfile.email || "Owner",
      actionType: 'permissions_updated',
      entityType: 'TeamMember',
      entityId: memberUidFromPath,
      entityName: targetMemberProfile.fullName || targetMemberProfile.email || memberUidFromPath,
      details: `Permissions updated for team member ${targetMemberProfile.fullName || memberUidFromPath}.`
    });

    const updatedMemberSnap = await memberDocRef.get();
    return NextResponse.json({ id: updatedMemberSnap.id, ...updatedMemberSnap.data() }, { status: 200 });

  } catch (error: any) {
    const pathUidForError = params?.memberUid || "UNKNOWN_MEMBER_UID_IN_PATH";
    const functionCallIdForError = `api_member_PUT_ERROR_${pathUidForError}_${Date.now()}`;
    console.error(`[${functionCallIdForError}] API PUT /api/team/members/[${pathUidForError}] error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR_MEMBER_PUT' }, { status: 500 });
  }
}
