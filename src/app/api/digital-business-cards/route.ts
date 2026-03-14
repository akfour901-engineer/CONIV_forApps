
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import type { DigitalBusinessCard, UserProfile, TeamMember, AppConfiguration, Company } from '@/types';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { v4 as uuidv4 } from 'uuid';
import { DIGITAL_BUSINESS_CARD_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const MAX_DATA_URI_LENGTH = 1.5 * 1024 * 1024; // 1.5MB to allow for base64 overhead

const digitalBusinessCardCreateSchema = z.object({
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
  dataOwnerId: z.string().min(1, "Data owner context is required."),
});

export async function POST(request: Request) {
  const functionCallId = `api_digital_cards_POST_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = digitalBusinessCardCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    
    const { dataOwnerId, ...dataFromClient } = validationResult.data;

    const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    const actorProfile = actorProfileDoc.data() as UserProfile;
    
    let canCreate = false;
    if (authenticatedUserUid === dataOwnerId) canCreate = true;
    else if (actorProfile.ownerId === dataOwnerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageDigitalBusinessCards) canCreate = true;
      }
    }
    if (!canCreate) return NextResponse.json({ error: 'Forbidden: No permission to create Digital Business Cards' }, { status: 403 });

    const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction', code: 'OWNER_PROFILE_NOT_FOUND_DBC_POST' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let actualCost = DIGITAL_BUSINESS_CARD_CREATION_COST; 

    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "DIGITAL_BUSINESS_CARD_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') actualCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`[${functionCallId}] API /digital-business-cards POST: Error fetching app config for cost, using default: ${actualCost}. Error: ${configError.message}`);
    }

    if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
        return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    
    const now = new Date().toISOString();
    const publicViewId = uuidv4(); 

    let finalCompanyName = dataFromClient.companyName || null;
    let finalLogoUrl = dataFromClient.logoUrl || null;

    if (dataFromClient.companyId) {
        const companyDocRef = adminDb.collection('companies').doc(dataFromClient.companyId);
        const companySnap = await companyDocRef.get();
        if (companySnap.exists && companySnap.data()?.userId === dataOwnerId) {
            const companyData = companySnap.data() as Company;
            finalCompanyName = companyData.name;
            finalLogoUrl = companyData.logoUrl || finalLogoUrl; // Use company logo if not provided
        }
    }

    const newCardData: Omit<DigitalBusinessCard, 'id' | 'qrCodeDataUrl'> = {
      userId: dataOwnerId,
      createdByName: actorProfile.fullName || actorProfile.email || "User",
      cardName: dataFromClient.cardName,
      fullName: dataFromClient.fullName,
      title: dataFromClient.title || null,
      companyId: dataFromClient.companyId || null,
      companyName: finalCompanyName,
      phoneNumber: dataFromClient.phoneNumber || null,
      email: dataFromClient.email || null,
      website: dataFromClient.website || null,
      address: dataFromClient.address || null,
      linkedIn: dataFromClient.linkedIn || null,
      twitter: dataFromClient.twitter || null,
      profilePictureUrl: dataFromClient.profilePictureUrl || null,
      logoUrl: finalLogoUrl,
      customColor: dataFromClient.customColor || null,
      notes: dataFromClient.notes || null,
      publicViewId: publicViewId,
      status: 'active', // Default status for new cards
      createdAt: now,
      updatedAt: now,
      updatedBy: authenticatedUserUid,
      updatedByName: actorProfile.fullName || actorProfile.email || "User",
    };
    
    const cleanedData: { [key: string]: any } = {};
    for (const key in newCardData) {
      if (newCardData[key as keyof typeof newCardData] !== undefined) {
         if (newCardData[key as keyof typeof newCardData] === "") {
             cleanedData[key] = null;
         } else {
             cleanedData[key] = newCardData[key as keyof typeof newCardData];
         }
      }
    }

    const batch = adminDb.batch();
    const newCardRef = adminDb.collection('digitalBusinessCards').doc();
    batch.set(newCardRef, cleanedData);

    batch.update(pointPayerProfileRef, {
      resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
      resourcePointsLastUpdated: now,
    });
    
    await batch.commit();

    await logActivity({
      ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || actorProfile.email || "User",
      actionType: 'create', entityType: 'DigitalBusinessCard', entityId: newCardRef.id, entityName: newCardData.cardName,
      details: { message: `Digital Business Card '${newCardData.cardName}' created.`, cost: actualCost }
    });
    
    return NextResponse.json({ id: newCardRef.id, ...newCardData, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - actualCost, cost: actualCost }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/digital-business-cards POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    const url = new URL(request.url);
    const requestedDataOwnerId = url.searchParams.get('dataOwnerId');
    if (!requestedDataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) {
      canAccess = true;
    } else {
      const memberProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
      if (memberProfileDoc.exists) {
        const memberProfile = memberProfileDoc.data() as UserProfile;
        if (memberProfile.ownerId === requestedDataOwnerId) {
          const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
          const teamMemberDocSnap = await teamMemberDocRef.get();
          if (teamMemberDocSnap.exists) {
            const teamMemberData = teamMemberDocSnap.data() as TeamMember;
            if (teamMemberData.permissions?.canManageDigitalBusinessCards) canAccess = true;
          }
        }
      }
    }

    if (!canAccess) return NextResponse.json({ error: 'Forbidden: Not authorized for this data' }, { status: 403 });

    const cardsSnapshot = await adminDb.collection('digitalBusinessCards')
      .where('userId', '==', requestedDataOwnerId)
      .get();
    const cards: DigitalBusinessCard[] = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DigitalBusinessCard));
    
    cards.sort((a, b) => a.cardName.localeCompare(b.cardName));
    
    return NextResponse.json(cards, { status: 200 });

  } catch (error: any) {
    console.error('API /api/digital-business-cards GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message, code: error.code }, { status: 500 });
  }
}

    