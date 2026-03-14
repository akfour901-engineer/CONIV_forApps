

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { DigitalBusinessCard, UserProfile, TeamMember, Company } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';

const MAX_DATA_URI_LENGTH = 1.5 * 1024 * 1024; // 1.5MB to allow for base64 overhead
export const dynamic = 'force-dynamic';
const digitalBusinessCardUpdateSchema = z.object({
  cardName: z.string().min(2, "Card name is required.").max(100),
  fullName: z.string().min(2, "Full name is required.").max(100),
  title: z.string().max(100).optional().or(z.literal('')),
  companyId: z.string().optional().nullable(),
  companyName: z.string().max(100).optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  website: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  linkedIn: z.string().url({ message: "Enter a valid LinkedIn URL."}).optional().or(z.literal('')),
  twitter: z.string().max(100).optional().or(z.literal('')),
  profilePictureUrl: z.string().max(MAX_DATA_URI_LENGTH, `Profile picture is too large.`).optional().nullable(),
  logoUrl: z.string().max(MAX_DATA_URI_LENGTH, `Logo is too large.`).optional().nullable(),
  customColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, {message: "Enter a valid hex color code, e.g., #FF5733"}).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
}).partial();


async function authorizeAccess(
  cardId: string,
  authenticatedUserUid: string | null,
  action: 'view' | 'edit' | 'delete'
): Promise<{ authorized: boolean; cardData?: DigitalBusinessCard; dataOwnerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
    const adminDb = getDb();
    const cardDocRef = adminDb.collection('digitalBusinessCards').doc(cardId);
    const cardSnap = await cardDocRef.get();
    if (!cardSnap.exists) {
        return { authorized: false, error: 'Digital Business Card not found', status: 404 };
    }
    
    const cardData = { id: cardSnap.id, ...cardSnap.data() } as DigitalBusinessCard;
    const cardOwnerId = cardData.userId;

    // Public view action for active cards does not require authentication
    if (action === 'view' && cardData.status === 'active') {
        return { authorized: true, cardData, dataOwnerId: cardOwnerId };
    }

    if (!authenticatedUserUid) {
        return { authorized: false, error: 'Authentication required for this action.', status: 401 };
    }

    const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!authUserProfileDoc.exists) {
        return { authorized: false, error: 'Authenticated user profile not found', status: 403 };
    }
    const actorProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
    
    // Case 1: The user is the direct owner of the card.
    if (cardOwnerId === authenticatedUserUid) {
        return { authorized: true, cardData, dataOwnerId: cardOwnerId, actorProfile };
    }
    
    // Case 2: The user is a team member. Check if they belong to the item's owner and have permission.
    if (actorProfile.ownerId && actorProfile.ownerId === cardOwnerId) {
        const teamMemberDocRef = adminDb.collection('users').doc(cardOwnerId).collection('teamMembers').doc(authenticatedUserUid);
        const teamMemberDocSnap = await teamMemberDocRef.get();
        if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            
            // For view, any team member can view their owner's cards (even non-active)
            if (action === 'view') {
                return { authorized: true, cardData, dataOwnerId: cardOwnerId, actorProfile };
            }
            
            // For edit/delete, a specific permission is required
            if ((action === 'edit' || action === 'delete') && teamMemberData.permissions?.canManageDigitalBusinessCards) {
                return { authorized: true, cardData, dataOwnerId: cardOwnerId, actorProfile };
            }
        }
    }

    return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { cardId: string } }) {
  const cardId = params.cardId;
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    let authenticatedUserUid: string | null = null; 
    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      const idToken = authorizationHeader.split('Bearer ')[1];
      try {
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        authenticatedUserUid = decodedToken.uid;
      } catch (tokenError) {
        console.warn("Token verification failed for GET card, proceeding as public:", tokenError);
      }
    }
    
    const authResult = await authorizeAccess(cardId, authenticatedUserUid, 'view');
    if (!authResult.authorized || !authResult.cardData) return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    
    return NextResponse.json(authResult.cardData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/digital-business-cards/[${cardId}] GET error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { cardId: string } }) {
  const cardId = params.cardId;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const authResult = await authorizeAccess(cardId, authenticatedUserUid, 'edit');
    if (!authResult.authorized || !authResult.cardData || !authResult.dataOwnerId || !authResult.actorProfile) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    const requestBody = await request.json();
    const validationResult = digitalBusinessCardUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const actorProfile = authResult.actorProfile;

    const dataToUpdate: Partial<DigitalBusinessCard> = {
      ...dataFromClient,
      updatedAt: new Date().toISOString(),
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };
    
    if (dataFromClient.companyId && dataFromClient.companyId !== authResult.cardData.companyId) {
        const companyDocRef = adminDb.collection('companies').doc(dataFromClient.companyId);
        const companySnap = await companyDocRef.get();
        if (companySnap.exists && companySnap.data()?.userId === authResult.dataOwnerId) {
            const companyData = companySnap.data() as Company;
            dataToUpdate.companyName = companyData.name;
            if(dataFromClient.logoUrl === undefined || dataFromClient.logoUrl === authResult.cardData.logoUrl) { 
                dataToUpdate.logoUrl = companyData.logoUrl || null;
            }
        }
    } else if (dataFromClient.companyId === null) {
        dataToUpdate.companyName = null;
        dataToUpdate.logoUrl = null;
    }


    const cleanedData: { [key: string]: any } = {};
    for (const key in dataToUpdate) {
      const typedKey = key as keyof typeof dataToUpdate;
      if (dataToUpdate[typedKey] !== undefined) {
         if (dataToUpdate[typedKey] === "") {
             cleanedData[key] = null;
         } else {
             cleanedData[key] = dataToUpdate[typedKey];
         }
      }
    }

    const cardDocRef = adminDb.collection('digitalBusinessCards').doc(cardId);
    await cardDocRef.update(cleanedData);

    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
        actionType: 'update', entityType: 'DigitalBusinessCard', entityId: cardId, entityName: dataToUpdate.cardName || authResult.cardData.cardName,
        details: `Digital Business Card '${dataToUpdate.cardName || authResult.cardData.cardName}' updated.`
    });

    const updatedDoc = await cardDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/digital-business-cards/[${cardId}] PUT error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { cardId: string } }) {
  const cardId = params.cardId;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    const authResult = await authorizeAccess(cardId, authenticatedUserUid, 'delete');
    if (!authResult.authorized || !authResult.cardData || !authResult.dataOwnerId || !authResult.actorProfile) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    const actorProfile = authResult.actorProfile;


    await adminDb.collection('digitalBusinessCards').doc(cardId).delete();
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
        actionType: 'delete', entityType: 'DigitalBusinessCard', entityId: cardId, entityName: authResult.cardData.cardName,
        details: `Digital Business Card '${authResult.cardData.cardName}' deleted.`
    });
    return NextResponse.json({ message: 'Digital Business Card deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/digital-business-cards/[${cardId}] DELETE error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

