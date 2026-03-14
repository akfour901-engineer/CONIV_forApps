

import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, MailingListEntry, TeamMember, AppConfiguration, Organization, Subcontractor } from '@/types/server-only';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import * as admin from 'firebase-admin';
import { MAILING_LIST_ADDITION_COST } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const entryCreateSchema = z.object({
  email: z.string().email("Invalid email format."),
  name: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  organizationId: z.string().optional().nullable(),
  subcontractorId: z.string().optional().nullable(),
  dataOwnerId: z.string().min(1),
  mailingListIds: z.array(z.string()).optional(),
});

async function canAccessMailingList(authenticatedUserUid: string, dataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === dataOwnerId) return true;
  const adminDb = getDb();
  const memberDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (memberDoc.exists && (memberDoc.data() as UserProfile).ownerId === dataOwnerId) {
    const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
    if (teamMemberDoc.exists) {
      return (teamMemberDoc.data() as TeamMember).permissions.canManageMailingList;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    if (!dataOwnerId) return NextResponse.json({ error: 'dataOwnerId is required' }, { status: 400 });

    if (!(await canAccessMailingList(decodedToken.uid, dataOwnerId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snapshot = await adminDb.collection('mailingList').where('userId', '==', dataOwnerId).get();
    let entries: MailingListEntry[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailingListEntry));
    
    // Perform sorting in code to avoid composite index
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(entries, { status: 200 });
  } catch (error: any) {
    console.error("API /marketing/mailing-list GET error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const actorUid = decodedToken.uid;
        
        const requestBody = await request.json();
        const validationResult = entryCreateSchema.safeParse(requestBody);
        if(!validationResult.success) return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
        
        const { dataOwnerId, ...data } = validationResult.data;
        
        const actorProfileSnap = await adminDb.collection('users').doc(actorUid).get();
        if (!actorProfileSnap.exists) return NextResponse.json({ error: 'Actor profile not found' }, { status: 403 });
        const actorProfile = actorProfileSnap.data() as UserProfile;
        
        if (!(await canAccessMailingList(actorUid, dataOwnerId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
        const pointPayerProfileSnap = await pointPayerProfileRef.get();
        if (!pointPayerProfileSnap.exists) return NextResponse.json({ error: 'Point payer profile not found' }, { status: 404 });
        
        const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
        
        let cost = MAILING_LIST_ADDITION_COST;
        try {
            const configSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
            if(configSnap.exists) {
                const configData = configSnap.data() as AppConfiguration;
                cost = configData.actionCosts?.find(c => c.key === 'MAILING_LIST_ADDITION_COST')?.cost ?? MAILING_LIST_ADDITION_COST;
            }
        } catch(e) { console.warn("Could not load cost config for mailing list addition."); }

        if ((pointPayerProfileData.resourcePoints ?? 0) < cost) {
             return NextResponse.json({ error: `Insufficient points. You need ${cost} points to add a contact.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
        }
        
        const existingEntryQuery = adminDb.collection('mailingList').where('userId', '==', dataOwnerId).where('email', '==', data.email).limit(1);
        const existingEntrySnap = await existingEntryQuery.get();
        if(!existingEntrySnap.empty) {
            return NextResponse.json({ error: "An entry with this email address already exists in your list." }, { status: 409 });
        }
        
        let companyName: string | null = null;
        if(data.organizationId) {
            const orgDoc = await adminDb.collection('organizations').doc(data.organizationId).get();
            if(orgDoc.exists) companyName = (orgDoc.data() as Organization).name;
        } else if (data.subcontractorId) {
            const subDoc = await adminDb.collection('subcontractors').doc(data.subcontractorId).get();
            if(subDoc.exists) companyName = (subDoc.data() as Subcontractor).name;
        }

        const now = new Date().toISOString();
        const docRef = adminDb.collection('mailingList').doc(); // Auto-generate ID
        
        const newEntryData: Omit<MailingListEntry, 'id'> = {
            email: data.email,
            name: data.name || null,
            company: companyName,
            phone: data.phone || null,
            status: 'manual_entry',
            notes: data.notes || null,
            source: 'manual',
            addedByUid: actorUid,
            addedByName: actorProfile.fullName || actorProfile.email,
            createdAt: now,
            updatedAt: now,
            userId: dataOwnerId,
            organizationId: data.organizationId || null,
            subcontractorId: data.subcontractorId || null,
            mailingListIds: data.mailingListIds || [],
        };

        const batch = adminDb.batch();
        batch.set(docRef, newEntryData);
        batch.update(pointPayerProfileRef, {
            resourcePoints: admin.firestore.FieldValue.increment(-cost)
        });
        await batch.commit();

        await logActivity({
            ownerId: dataOwnerId,
            actorUid: actorUid,
            actorName: actorProfile.fullName || actorProfile.email || "User",
            actionType: 'mailing_list_contact_added',
            entityType: 'MailingListEntry',
            entityId: docRef.id,
            details: `Added ${data.email} to mailing list. Cost: ${cost} points.`
        });
        
        const newResourcePoints = (pointPayerProfileData.resourcePoints ?? 0) - cost;

        return NextResponse.json({ id: docRef.id, ...newEntryData, newResourcePoints, cost }, { status: 201 });
    } catch(error: any) {
        console.error("API /marketing/mailing-list POST error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
