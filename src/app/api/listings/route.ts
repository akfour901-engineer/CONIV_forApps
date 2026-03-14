
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { ListingItem, ListingItemType, ListingItemStatus, UserProfile, TeamMember, AppConfiguration, Company } from '@/types';
import { LISTING_ITEM_TYPE_OPTIONS, LISTING_ITEM_STATUS_OPTIONS } from '@/types/server-only';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { v4 as uuidv4 } from 'uuid';
import { MARKETPLACE_LISTING_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const MAX_FILE_SIZE_MB = 0.75; // 750KB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const listingItemCreateSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  itemType: z.enum(LISTING_ITEM_TYPE_OPTIONS),
  category: z.string().max(100).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  exchangeFor: z.string().max(255).optional().nullable(),
  imageUrls: z.array(z.string().url().or(z.string().startsWith('data:image/'))).max(5, `Cannot upload more than 5 images.`).optional().nullable(),
  status: z.enum(LISTING_ITEM_STATUS_OPTIONS).default('active'),
  contactName: z.string().max(100).optional().or(z.literal('')),
  contactPhone: z.string().optional().nullable()
    .refine(val => !val || val === '' || /^\+?[0-9\s-()]{7,20}$/.test(val), { message: "Invalid phone number format." }),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  localityOrArea: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().optional().nullable()
    .refine(val => !val || val === '' || /^\d{6}$/.test(val), { message: "Pincode must be 6 digits if provided." }),
  country: z.string().default("India").optional(),
  dataOwnerId: z.string().min(1, "Data owner context is required."),
  companyId: z.string().optional().nullable(), // Added companyId
});

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!userProfileDoc.exists) return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    const userProfile = userProfileDoc.data() as UserProfile;
    const requestDataOwnerId = userProfile.ownerId || authenticatedUserUid;

    const userListingsQuery = adminDb.collection('listingItems').where('userId', '==', requestDataOwnerId).orderBy('createdAt', 'desc');
    const userListingsSnap = await userListingsQuery.get();
    const userListings: ListingItem[] = userListingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListingItem));

    const allPublicListingsQuery = adminDb.collection('listingItems')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc');
    const allPublicListingsSnap = await allPublicListingsQuery.get();
    
    const otherPublicListings: ListingItem[] = allPublicListingsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as ListingItem))
      .filter(listing => listing.userId !== requestDataOwnerId);

    const combinedListings = [...userListings, ...otherPublicListings];
    const uniqueListings = Array.from(new Map(combinedListings.map(item => [item.id, item])).values());
    uniqueListings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(uniqueListings, { status: 200 });

  } catch (error: any) {
    console.error('API /api/listings GET error:', error.code, error.message, error.stack);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}


export async function POST(request: Request) {
  const functionCallId = `api_listings_POST_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = listingItemCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId: clientDataOwnerId, ...dataFromClient } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;
    
    const listingOwnerId = clientDataOwnerId;
    
    let canCreate = false;
    if (authenticatedUserUid === listingOwnerId) { 
      canCreate = true;
    } 
    else if (actorProfile.ownerId === listingOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(listingOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageListings) canCreate = true;
      }
    }

    if (!canCreate) {
        return NextResponse.json({ error: 'Forbidden: No permission to create listings for this account.' }, { status: 403 });
    }

    const pointPayerProfileRef = adminDb.collection('users').doc(listingOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_LISTING_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = MARKETPLACE_LISTING_CREATION_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "MARKETPLACE_LISTING_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /listings POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }

    const now = new Date().toISOString();
    
    let finalCompanyName: string | null = null;
    let finalLogoUrl: string | null = null;

    if (dataFromClient.companyId) {
        const companyDocRef = adminDb.collection('companies').doc(dataFromClient.companyId);
        const companySnap = await companyDocRef.get();
        if (companySnap.exists && companySnap.data()?.userId === listingOwnerId) {
            const companyData = companySnap.data() as Company;
            finalCompanyName = companyData.name;
            finalLogoUrl = companyData.logoUrl || null;
        }
    }

    const newListingData: Omit<ListingItem, 'id'> = {
      userId: listingOwnerId,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      title: dataFromClient.title,
      description: dataFromClient.description,
      itemType: dataFromClient.itemType as ListingItemType,
      category: dataFromClient.category || null,
      price: (dataFromClient.itemType === 'sell' || dataFromClient.itemType === 'buy') ? (dataFromClient.price ?? null) : null,
      exchangeFor: dataFromClient.itemType === 'exchange' ? (dataFromClient.exchangeFor || null) : null,
      imageUrls: dataFromClient.imageUrls || null,
      logoUrl: finalLogoUrl, // Add logoUrl to the object
      companyId: dataFromClient.companyId || null, // Add companyId
      companyName: finalCompanyName, // Add companyName
      status: dataFromClient.status as ListingItemStatus,
      contactName: dataFromClient.contactName || actorProfile?.fullName || null,
      contactPhone: dataFromClient.contactPhone || actorProfile?.phoneNumber || null,
      contactEmail: actorProfile?.email || null,
      addressLine1: dataFromClient.addressLine1 || null,
      addressLine2: dataFromClient.addressLine2 || null,
      localityOrArea: dataFromClient.localityOrArea || null,
      city: dataFromClient.city || null,
      district: dataFromClient.district || null,
      state: dataFromClient.state || null,
      pincode: dataFromClient.pincode || null,
      country: dataFromClient.country || "India",
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };
    
    const cleanedData: { [key: string]: any } = {};
    for (const key in newListingData) {
      if (newListingData[key as keyof typeof newListingData] !== undefined) {
         if (newListingData[key as keyof typeof newListingData] === "") {
             cleanedData[key] = null;
         } else {
             cleanedData[key] = newListingData[key as keyof typeof newListingData];
         }
      }
    }

    const batch = adminDb.batch();
    const newListingRef = adminDb.collection('listingItems').doc();
    batch.set(newListingRef, cleanedData);

    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });
    
    await batch.commit();
    const finalData = { id: newListingRef.id, ...newListingData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost };

    await logActivity({
      ownerId: listingOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create', entityType: 'ListingItem', entityId: newListingRef.id, entityName: newListingData.title,
      details: { message: `Marketplace listing '${newListingData.title}' created.`, cost: actualCost }
    });
    
    return NextResponse.json(finalData, { status: 201 });

  } catch (error: any) {
    console.error('API /api/listings POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

    