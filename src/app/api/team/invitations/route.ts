import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin'; 
import { z } from 'zod';
import type { TeamInvitation, TeamPermissions, UserProfile, AppConfiguration, WorkOrder } from '@/types/server-only';
import { DEFAULT_TEAM_PERMISSIONS } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import type { TeamMember } from '@/types/server-only';
import { sendEmail } from '@/lib/email/server-only-index';
import { APP_NAME } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const inviteTeamMemberFormSchema = z.object({
  invitedMemberName: z.string().min(2, "Member's name is required.").max(100),
  invitationMethod: z.enum(['email', 'phone']).default('email'),
  invitedEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  invitedCountryCode: z.string().optional().or(z.literal('')),
  invitedLocalPhoneNumber: z.string().optional().or(z.literal('')),
  associatedWorkOrderId: z.string().optional().nullable(),
  permissions: z.custom<TeamPermissions>((val) => typeof val === 'object' && val !== null, {
    message: "Permissions must be a valid object.",
  }).default(DEFAULT_TEAM_PERMISSIONS),
}).superRefine((data, ctx) => {
  if (data.invitationMethod === 'email') {
    if (!data.invitedEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required for email invitation.", path: ["invitedEmail"] });
    } else if (!z.string().email().safeParse(data.invitedEmail).success) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter a valid email address.", path: ["invitedEmail"] });
    }
  } else if (data.invitationMethod === 'phone') {
    if (!data.invitedCountryCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Country code is required for phone invitation.", path: ["invitedCountryCode"] });
    } else if (!/^\+\d{1,3}$/.test(data.invitedCountryCode)) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid country code (e.g., +91).", path: ["invitedCountryCode"] });
    }
    if (!data.invitedLocalPhoneNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Local phone number is required for phone invitation.", path: ["localPhoneNumber"] });
    } else if (!/^\d{7,15}$/.test(data.invitedLocalPhoneNumber)) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone number must be 7-15 digits.", path: ["localPhoneNumber"] });
    }
  }
});


export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  const functionCallId = `api_team_invitations_POST_${Date.now()}`;
  
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
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid; 

    const authUserProfileDocRef = adminDb.collection('users').doc(authenticatedUserUid);
    const authUserProfileSnap = await authUserProfileDocRef.get();
    
    if (!authUserProfileSnap.exists) {
        return NextResponse.json({ error: 'Forbidden: Authenticated user profile not found.', code: 'AUTH_USER_PROFILE_NOT_FOUND_INVITE_POST' }, { status: 403 });
    }
    const authUserProfile = authUserProfileSnap.data() as UserProfile;
    
    const dataOwnerId = authUserProfile.ownerId || authenticatedUserUid;

    let canInvite = false;
    if (authenticatedUserUid === dataOwnerId) { // Is the owner
        canInvite = true;
    } else if (authUserProfile.ownerId === dataOwnerId) { // Is a team member
        const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageTeam) { // Check for the new supervisor permission
                canInvite = true;
            }
        }
    }
    
    if (!canInvite) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to send invitations.' }, { status: 403 });
    }

    const requestBody = await request.json();
    const validationResult = inviteTeamMemberFormSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    const data = validationResult.data;

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId); // Points are always deducted from the owner
    const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
    const [pointPayerProfileSnap, appConfigSnap] = await Promise.all([pointPayerProfileRef.get(), appConfigDocRef.get()]);

    if (!pointPayerProfileSnap.exists) {
      return NextResponse.json({ error: 'Point payer profile not found for point deduction', code: 'POINT_PAYER_PROFILE_NOT_FOUND_INVITE_POST' }, { status: 404 });
    }
    
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = 0;
    
    if (appConfigSnap.exists) {
      const configData = appConfigSnap.data() as AppConfiguration;
      const costConfig = configData.actionCosts?.find(c => c.key === "TEAM_INVITATION_COST");
      actualCost = costConfig?.cost ?? 0;
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
      return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const invitationsRef = adminDb.collection("teamInvitations");
    let q: admin.firestore.Query = invitationsRef
      .where("ownerId", "==", dataOwnerId) 
      .where("status", "in", ["pending", "accepted"]);
    
    let identifierValue: string = '';
    if (data.invitationMethod === 'email' && data.invitedEmail) {
      identifierValue = data.invitedEmail;
      q = q.where("invitedEmail", "==", data.invitedEmail);
    } else if (data.invitationMethod === 'phone' && data.invitedCountryCode && data.invitedLocalPhoneNumber) {
      identifierValue = data.invitedCountryCode + data.invitedLocalPhoneNumber;
      q = q.where("invitedPhoneNumber", "==", identifierValue);
    } else {
      return NextResponse.json({ error: 'Invalid invitation method or missing identifier.' }, { status: 400 });
    }
    
    if (data.associatedWorkOrderId) {
      q = q.where("associatedWorkOrderId", "==", data.associatedWorkOrderId);
    } else {
      q = q.where("associatedWorkOrderId", "==", null); 
    }
    q = q.limit(1);

    const existingInviteSnapshot = await q.get();
    if (!existingInviteSnapshot.empty) {
      const existingData = existingInviteSnapshot.docs[0].data();
      let message = `An invitation is already ${existingData.status} for ${identifierValue}`;
      if (!!(data.associatedWorkOrderId && existingData.associatedWorkOrderId === data.associatedWorkOrderId)) message += ` for this specific work order scope.`;
      else if (!!(!data.associatedWorkOrderId && !existingData.associatedWorkOrderId)) message += ` for general team access.`;
      if (existingData.status === 'accepted') message = `${identifierValue} is already an active member for this scope or generally.`
      return NextResponse.json({ error: message, code: 'INVITATION_EXISTS' }, { status: 409 });
    }

    let associatedWorkOrderNumber: string | undefined | null = undefined;
    if (data.associatedWorkOrderId) {
      const woDoc = await adminDb.collection('workOrders').doc(data.associatedWorkOrderId).get();
      
      if (woDoc.exists && woDoc.data()?.userId === dataOwnerId) {
        associatedWorkOrderNumber = (woDoc.data() as WorkOrder).workOrderNumber;
      } else {
        return NextResponse.json({ error: 'Associated Work Order not found or not accessible.' }, { status: 404 });
      }
    }
    
    const ownerProfileDoc = await adminDb.collection('users').doc(dataOwnerId).get();
    const ownerName = ownerProfileDoc.data()?.fullName || ownerProfileDoc.data()?.email || "Team Owner";

    const now = new Date().toISOString();
    const newInvitationData: Omit<TeamInvitation, 'id'> = {
      ownerId: dataOwnerId, 
      ownerName: ownerName,
      invitedMemberName: data.invitedMemberName,
      invitedEmail: data.invitationMethod === 'email' ? data.invitedEmail : null,
      invitedPhoneNumber: data.invitationMethod === 'phone' && data.invitedCountryCode && data.invitedLocalPhoneNumber ? (data.invitedCountryCode + data.invitedLocalPhoneNumber) : null,
      permissions: data.permissions,
      status: 'pending',
      associatedWorkOrderId: data.associatedWorkOrderId || null,
      associatedWorkOrderNumber: associatedWorkOrderNumber || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const appName = appConfigSnap.exists ? (appConfigSnap.data() as AppConfiguration).appName || APP_NAME : APP_NAME;

    if (newInvitationData.invitedEmail) {
      await sendEmail({
        to: newInvitationData.invitedEmail,
        subject: `You're invited to join ${ownerName}'s team on ${appName}`,
        body: `
          <h1>Team Invitation</h1>
          <p>Hi ${newInvitationData.invitedMemberName},</p>
          <p>You have been invited by <strong>${ownerName}</strong> to join their team on ${appName}.</p>
          <p>Please sign up or log in to your account at ${request.headers.get('origin') || 'our app'} to accept the invitation.</p>
          <br/>
          <p>Thank you,</p>
          <p>The ${appName} Team</p>
        `,
      });
    }

    const batch = adminDb.batch();
    const newInvitationRef = adminDb.collection('teamInvitations').doc();
    batch.set(newInvitationRef, newInvitationData);
    
    const newResourcePoints = (pointPayerProfileData.resourcePoints ?? 0) - actualCost;
    batch.update(pointPayerProfileRef, { resourcePoints: newResourcePoints, resourcePointsLastUpdated: now });
    
    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId, 
      actorUid: authenticatedUserUid, 
      actorName: authUserProfile.fullName || authUserProfile.email || "User",
      actionType: 'invite_sent', entityType: 'TeamInvitation', entityId: newInvitationRef.id, entityName: data.invitedMemberName,
      details: { message: `Invited ${identifierValue} for WO: ${associatedWorkOrderNumber || 'General'}.`, cost: actualCost }
    });

    return NextResponse.json({ id: newInvitationRef.id, ...newInvitationData, newResourcePoints, cost: actualCost }, { status: 201 });
  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/team/invitations POST error (outer catch):`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code || 'UNKNOWN_SERVER_ERROR_API_POST' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  const functionCallId = `api_team_invitations_GET_${Date.now()}`;
  
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
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', details: error.message, code: error.code }, { status: 401 });
    }
    const authenticatedUserUid = decodedToken.uid;
    
    const url = new URL(request.url);
    const dataOwnerIdToQuery = url.searchParams.get('dataOwnerId');

    if (!dataOwnerIdToQuery) {
        return NextResponse.json({ error: 'Bad Request: dataOwnerId query parameter is required.' }, { status: 400 });
    }

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return NextResponse.json({ error: 'Forbidden: User profile not found, cannot determine team scope.', code: 'AUTH_USER_PROFILE_NOT_FOUND_INVITE_GET'}, { status: 403 });
    }
    const authUserProfile = authUserProfileDoc.data() as UserProfile;
    
    let canAccess = false;
    if (authenticatedUserUid === dataOwnerIdToQuery) { // Owner viewing their own invites
        canAccess = true;
    } else if(authUserProfile.ownerId === dataOwnerIdToQuery) { // Team member checking invites for their owner
        const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerIdToQuery).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists && (teamMemberDocSnap.data() as TeamMember).permissions?.canManageTeam) {
            canAccess = true;
        }
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden: You can only view invitations you have sent.', code: 'FORBIDDEN_INVITE_LIST' }, { status: 403 });
    }

    // Fixed: Removed orderBy from query to avoid needing a composite index
    const invitationsQuery = adminDb.collection('teamInvitations')
      .where('ownerId', '==', dataOwnerIdToQuery) 
      .where('status', '==', 'pending');
      
    const invitationsSnapshot = await invitationsQuery.get();
    const invitations: TeamInvitation[] = invitationsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as TeamInvitation))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
    return NextResponse.json(invitations, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] API /api/team/invitations GET error (outer catch):`, error);
    let errorMessage = error.message || "An unspecified error occurred while fetching invitations.";
    let errorCode = error.code || 'UNKNOWN_SERVER_ERROR_API_GET';
    return NextResponse.json({ error: 'Internal server error', details: errorMessage, code: errorCode }, { status: 500 });
  }
}
