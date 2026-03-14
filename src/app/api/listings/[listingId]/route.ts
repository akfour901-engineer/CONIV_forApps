
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { ListingItem, ListingItemType, ListingItemStatus, UserProfile, TeamMember, Company } from '@/types/server-only';
import { LISTING_ITEM_TYPE_OPTIONS, LISTING_ITEM_STATUS_OPTIONS } from '@/types/server-only';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';

const MAX_DATA_URI_LENGTH = 1048487;
export const dynamic = 'force-dynamic';
async function authorizeAccess(
  listingId: string,
  authenticatedUserUid: string | null,
  action: 'view' | 'edit' | 'delete'
): Promise<{ authorized: boolean; listingData?: ListingItem; dataOwnerId?: string; actorProfile?: UserProfile; error?: string; status?: number }> {
  
  const adminDb = getDb();
  if (!listingId) {
    return { authorized: false, error: 'Listing ID is required', status: 400 };
  }
  const listingDocRef = adminDb.collection('listingItems').doc(listingId);
  const listingSnap = await listingDocRef.get();
  if (!listingSnap.exists) {
    return { authorized: false, error: 'Listing not found', status: 404 };
  }
  
  const listingData = { id: listingSnap.id, ...listingSnap.data() } as ListingItem;
  const itemOwnerId = listingData.userId;

  // Public view action for active cards does not require authentication for GET requests
  if (action === 'view' && listingData.status === 'active') {
    return { authorized: true, listingData, dataOwnerId: itemOwnerId };
  }

  if (!authenticatedUserUid) {
      return { authorized: false, error: 'Authentication required for this action.', status: 401 };
  }

  const authUserProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!authUserProfileDoc.exists) {
    return { authorized: false, error: 'Authenticated user profile not found', status: 403 };
  }
  const actorProfile = { uid: authUserProfileDoc.id, ...authUserProfileDoc.data() } as UserProfile;
  const requestorDataOwnerContext = actorProfile.ownerId || actorProfile.uid;
  
  // Case 1: The user is the direct owner of the listing.
  if (itemOwnerId === authenticatedUserUid) {
      return { authorized: true, listingData, dataOwnerId: itemOwnerId, actorProfile };
  }
  
  // Case 2: The user is a team member trying to manage their owner's listing.
  // Check if the item belongs to the team they are supervising.
  if (actorProfile.ownerId && actorProfile.ownerId === itemOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(itemOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (action === 'view' || teamMemberData.permissions?.canManageListings) {
            return { authorized: true, listingData, dataOwnerId: itemOwnerId, actorProfile };
        }
    }
  }

  return { authorized: false, error: 'Forbidden: You do not have permission for this action.', status: 403 };
}


export async function GET(request: Request, { params }: { params: { listingId: string } }) {
  const listingId = params?.listingId;
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
        console.warn("Token verification failed for GET listing, proceeding as public viewer:", tokenError);
      }
    }
    
    if (!listingId) {
      return NextResponse.json({ error: 'Bad Request: Listing ID is required.' }, { status: 400 });
    }

    const authResult = await authorizeAccess(listingId, authenticatedUserUid, 'view');
    if (!authResult.authorized || !authResult.listingData) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    return NextResponse.json(authResult.listingData, { status: 200 });
  } catch (error: any) {
    console.error(`API /api/listings/[${listingId}] GET error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

const listingItemUpdateSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100).optional(),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000).optional(),
  itemType: z.enum(LISTING_ITEM_TYPE_OPTIONS).optional(),
  category: z.string().max(100).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  exchangeFor: z.string().max(255).optional().nullable(),
  imageUrls: z.array(z.string().url().or(z.string().startsWith('data:image/'))).max(5).optional().nullable(),
  status: z.enum(LISTING_ITEM_STATUS_OPTIONS).optional(),
  contactName: z.string().max(100).optional().nullable(),
  contactPhone: z.string().optional().nullable().refine(val => !val || val === '' || /^\+?[0-9\s-()]{7,20}$/.test(val), { message: "Invalid phone format." }),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  localityOrArea: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().optional().nullable().refine(val => !val || val === '' || /^\d{6}$/.test(val), { message: "Pincode must be 6 digits." }),
  country: z.string().optional(),
}).partial().superRefine((data, ctx) => {
  if (data.itemType && (data.itemType === 'sell' || data.itemType === 'buy')) {
    // For partial updates, price requirement is trickier without fetching current state.
  }
  if (data.itemType && data.itemType === 'exchange' && data.exchangeFor === undefined) {
    // Similar logic for exchangeFor
  }
});

export async function PUT(request: Request, { params }: { params: { listingId: string } }) {
  const listingId = params?.listingId;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;
    
    if (!listingId) {
      return NextResponse.json({ error: 'Bad Request: Listing ID is required.' }, { status: 400 });
    }

    const authResult = await authorizeAccess(listingId, authenticatedUserUid, 'edit');
    if (!authResult.authorized || !authResult.listingData || !authResult.dataOwnerId || !authResult.actorProfile) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    
    const requestBody = await request.json();
    const validationResult = listingItemUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
    
    const dataFromClient = validationResult.data;
    const actorProfile = authResult.actorProfile;

    const dataToUpdate: Partial<ListingItem> = {
        ...dataFromClient,
        itemType: dataFromClient.itemType as ListingItemType | undefined,
        status: dataFromClient.status as ListingItemStatus | undefined,
    };
    dataToUpdate.updatedAt = new Date().toISOString();
    dataToUpdate.updatedBy = authenticatedUserUid;
    dataToUpdate.updatedByName = actorProfile.fullName || actorProfile.email || "User";

    if (dataFromClient.itemType && (dataFromClient.itemType !== 'sell' && dataFromClient.itemType !== 'buy')) {
        dataToUpdate.price = null;
    }
    if (dataFromClient.itemType && dataFromClient.itemType !== 'exchange') {
        dataToUpdate.exchangeFor = null;
    }

    const cleanedDataToUpdate: { [key: string]: any } = {};
    for (const key in dataToUpdate) {
        if (dataToUpdate[key as keyof typeof dataToUpdate] !== undefined) {
           if (dataToUpdate[key as keyof typeof dataToUpdate] === "") {
               cleanedDataToUpdate[key] = null;
           } else {
               cleanedDataToUpdate[key] = dataToUpdate[key as keyof typeof dataToUpdate];
           }
        }
    }
    if (dataFromClient.imageUrls === null) cleanedDataToUpdate.imageUrls = null;
    
    const listingDocRef = adminDb.collection('listingItems').doc(listingId);
    await listingDocRef.update(cleanedDataToUpdate);

    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
        actionType: 'update', entityType: 'ListingItem', entityId: listingId, entityName: dataToUpdate.title || authResult.listingData.title,
        details: `Marketplace listing updated: ${dataToUpdate.title || authResult.listingData.title}`
    });

    const updatedDoc = await listingDocRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/listings/[${listingId}] PUT error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { listingId: string } }) {
  const listingId = params?.listingId;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    if (!listingId) {
      return NextResponse.json({ error: 'Bad Request: Listing ID is required.' }, { status: 400 });
    }
    
    const authResult = await authorizeAccess(listingId, authenticatedUserUid, 'delete');
    if (!authResult.authorized || !authResult.listingData || !authResult.dataOwnerId || !authResult.actorProfile) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status || 403 });
    }
    const actorProfile = authResult.actorProfile;


    await adminDb.collection('listingItems').doc(listingId).delete();
    await logActivity({
        ownerId: authResult.dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
        actionType: 'delete', entityType: 'ListingItem', entityId: listingId, entityName: authResult.listingData.title,
        details: `Marketplace listing '${authResult.listingData.title}' deleted.`
    });
    return NextResponse.json({ message: 'Listing deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`API /api/listings/[${listingId}] DELETE error:`, error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}
