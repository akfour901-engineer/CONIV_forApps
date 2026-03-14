

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { SorRate, Organization, UserProfile, TeamMember, AppConfiguration } from '@/types';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import { SOR_RATE_CREATION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const sorRateBulkItemSchema = z.object({
  itemCode: z.string().min(1, "Item code is required.").max(50),
  itemDescription: z.string().min(1, "Description is required.").max(500),
  unit: z.string().min(1, "Unit is required.").max(20),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
  organizationId: z.string().optional().nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
});

const bulkCreateSchema = z.object({
  items: z.array(sorRateBulkItemSchema).min(1, "At least one item is required for bulk import."),
  dataOwnerId: z.string().min(1, "Data owner ID is required."),
});

export async function POST(request: Request) {

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const requestBody = await request.json();
    const validationResult = bulkCreateSchema.safeParse(requestBody);
    if (!validationResult.success) return NextResponse.json({ error: 'Invalid input data for bulk import', details: validationResult.error.flatten() }, { status: 400 });
    
    const { items: itemsToCreate, dataOwnerId: requestedDataOwnerId } = validationResult.data;

    const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!userProfileDoc.exists) return NextResponse.json({ error: 'User profile not found for authenticated user' }, { status: 403 });
    const userProfile = userProfileDoc.data() as UserProfile;
    const effectiveDataOwnerId = userProfile.ownerId || authenticatedUserUid;

    if (effectiveDataOwnerId !== requestedDataOwnerId) {
         return NextResponse.json({ error: 'Forbidden: dataOwnerId in request does not match authenticated user\'s data scope.' }, { status: 403 });
    }

    let canManage = false;
    if (authenticatedUserUid === effectiveDataOwnerId) canManage = true;
    else if (userProfile.ownerId) {
      const teamMemberDocRef = adminDb.collection('users').doc(effectiveDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
      const teamMemberDocSnap = await teamMemberDocRef.get();
      if (teamMemberDocSnap.exists) {
        const teamMemberData = teamMemberDocSnap.data() as TeamMember;
        if (teamMemberData.permissions?.canManageOwnerSORs) canManage = true;
      }
    }
    if (!canManage) return NextResponse.json({ error: 'Forbidden: No permission to bulk import SOR items' }, { status: 403 });

    // --- Coin Deduction Logic ---
    const pointPayerProfileRef = adminDb.collection('users').doc(effectiveDataOwnerId);
    const pointPayerProfileSnap = await pointPayerProfileRef.get();
    if (!pointPayerProfileSnap.exists) {
        return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
    }
    const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
    let perItemCost = SOR_RATE_CREATION_COST; // Default
    try {
        const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const appConfigSnap = await appConfigDocRef.get();
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            const costConfig = configData.actionCosts?.find(c => c.key === "SOR_RATE_CREATION_COST");
            if (costConfig && typeof costConfig.cost === 'number') perItemCost = costConfig.cost;
        }
    } catch (configError: any) {
        console.warn(`API /sor-rates/bulk POST: Error fetching app config for cost, using default: ${perItemCost}. Error: ${configError.message}`);
    }

    const privateItemsCount = itemsToCreate.filter(item => item.visibility === 'private').length;
    const totalCost = privateItemsCount * perItemCost;

    if ((pointPayerProfileData.resourcePoints ?? 0) < totalCost) {
        return NextResponse.json({ error: `Insufficient resource points for bulk import. Owner needs ${totalCost}, has ${pointPayerProfileData.resourcePoints ?? 0}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
    }
    // --- End Coin Deduction Logic ---

    const batch = adminDb.batch();
    const now = new Date().toISOString();
    let itemsAddedCount = 0;
    const errors: { rowIndex: number, message: string }[] = [];

    const organizationIds = new Set(itemsToCreate.map(item => item.organizationId).filter((id): id is string => !!id));
    const orgDetailsMap = new Map<string, { name: string }>();
    if (organizationIds.size > 0) {
        const orgsQuery = adminDb.collection('organizations').where(admin.firestore.FieldPath.documentId(), 'in', Array.from(organizationIds));
        const orgsSnapshot = await orgsQuery.get();
        orgsSnapshot.forEach(doc => {
            const orgData = doc.data() as Organization;
            if (orgData.visibility === 'public' || orgData.userId === effectiveDataOwnerId) {
                orgDetailsMap.set(doc.id, { name: orgData.name });
            }
        });
    }

    for (let i = 0; i < itemsToCreate.length; i++) {
      const item = itemsToCreate[i];
      let organizationName: string | null = null;
      if (item.organizationId) {
        if (orgDetailsMap.has(item.organizationId)) {
          organizationName = orgDetailsMap.get(item.organizationId)!.name;
        } else {
          console.warn(`SOR Bulk Import: Org ID ${item.organizationId} for item "${item.itemCode}" not found or not accessible.`);
        }
      }

      const newSorRateData: Omit<SorRate, 'id'> = {
        userId: effectiveDataOwnerId,
        createdByName: userProfile.fullName || userProfile.email || "User",
        itemCode: item.itemCode,
        itemDescription: item.itemDescription,
        unit: item.unit,
        rate: item.rate,
        visibility: item.visibility,
        organizationId: item.organizationId || null,
        organizationName: organizationName,
        createdAt: now,
        updatedAt: now,
        updatedBy: authenticatedUserUid,
        updatedByName: userProfile.fullName || userProfile.email || "User",
      };
      const newSorRef = adminDb.collection('sorRates').doc();
      batch.set(newSorRef, newSorRateData);
      itemsAddedCount++;
    }

    let newResourcePoints: number | undefined;
    if (totalCost > 0) {
      newResourcePoints = (pointPayerProfileData.resourcePoints ?? 0) - totalCost;
      batch.update(pointPayerProfileRef, {
        resourcePoints: admin.firestore.FieldValue.increment(-totalCost),
        resourcePointsLastUpdated: now,
      });
    }

    await batch.commit();
    await logActivity({
        ownerId: effectiveDataOwnerId,
        actorUid: authenticatedUserUid,
        actorName: userProfile.fullName || userProfile.email || "User",
        actionType: 'create',
        entityType: 'SorRate',
        entityName: `Bulk Import (${itemsAddedCount} items)`,
        details: { message: `Bulk imported ${itemsAddedCount} SOR items.`, cost: totalCost > 0 ? totalCost : undefined }
    });

    return NextResponse.json({ 
        message: `Bulk import processed. ${itemsAddedCount} SOR items added.`,
        itemsAdded: itemsAddedCount,
        errors: errors,
        newResourcePoints: newResourcePoints,
        cost: totalCost
    }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/sor-rates/bulk POST error:', error);
    return NextResponse.json({ error: 'Internal server error during bulk import', details: error.message }, { status: 500 });
  }
}
