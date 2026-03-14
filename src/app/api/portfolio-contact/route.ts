


import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { PortfolioContact, AppConfiguration, UserProfile, TeamMember } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import * as admin from 'firebase-admin';
export const dynamic = 'force-dynamic';
const PORTFOLIO_CONTACT_REQUEST_COST = 3;

const contactFormSchema = z.object({
  portfolioId: z.string().min(1, "Portfolio ID is required."),
  portfolioOwnerId: z.string().min(1, "Portfolio owner ID is required."),
  portfolioName: z.string().min(1, "Portfolio name is required."),
  name: z.string().min(2, "Name is required.").max(100),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(20).optional(),
  message: z.string().min(10, "Message should be at least 10 characters.").max(1000),
});

export async function POST(request: Request) {
  const adminDb = getDb();
  try {
    const requestBody = await request.json();
    const validationResult = contactFormSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { portfolioId, portfolioOwnerId, portfolioName, ...contactData } = validationResult.data;

    const ownerProfileRef = adminDb.collection('users').doc(portfolioOwnerId);
    const ownerProfileSnap = await ownerProfileRef.get();
    if (!ownerProfileSnap.exists) {
      console.warn(`Portfolio owner profile not found (ID: ${portfolioOwnerId}), but proceeding with contact request.`);
    }
    const ownerProfile = ownerProfileSnap.data() as UserProfile | undefined;
    
    let actualCost = PORTFOLIO_CONTACT_REQUEST_COST;
    try {
      const configSnap = await adminDb.collection('appConfiguration').doc('mainConfig').get();
      if(!!configSnap.exists) {
        const config = configSnap.data() as AppConfiguration;
        const costConfig = config.actionCosts?.find(c => c.key === 'PORTFOLIO_CONTACT_REQUEST_COST');
        if (costConfig?.cost !== undefined) {
          actualCost = costConfig.cost;
        }
      }
    } catch (e) {
        console.warn("Could not fetch cost config for portfolio contact request.");
    }
    
    const currentPoints = ownerProfile?.resourcePoints ?? 0;
    if (currentPoints < actualCost) {
        console.warn(`Portfolio owner (ID: ${portfolioOwnerId}) has insufficient points for contact request. Required: ${actualCost}, Has: ${currentPoints}.`);
    }
    
    // Use a batch write to ensure atomicity
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    // 1. Create the contact request document
    const newContactRef = adminDb.collection('portfolioContacts').doc();
    const newContact: Omit<PortfolioContact, 'id'> = {
      ...contactData,
      portfolioId,
      portfolioOwnerId,
      createdAt: now,
    };
    batch.set(newContactRef, newContact);

    // 2. Deduct points from the owner's account
    if (ownerProfile) {
        batch.update(ownerProfileRef, { 
            resourcePoints: admin.firestore.FieldValue.increment(-actualCost),
            resourcePointsLastUpdated: now,
        });
    }

    // Commit the batch to save contact and deduct points
    await batch.commit();

    // 3. Log the activity after the batch is successful
    await logActivity({
        ownerId: portfolioOwnerId,
        actorUid: 'PUBLIC_FORM_SUBMITTER',
        actorName: contactData.name,
        actionType: 'portfolio_contact_request',
        entityType: 'Portfolio',
        entityId: portfolioId,
        entityName: portfolioName,
        details: { message: `New contact request from ${contactData.name} (${contactData.email}).`, cost: actualCost }
    });

    return NextResponse.json({ success: true, message: 'Your message has been sent successfully!' }, { status: 201 });

  } catch (error: any) {
    console.error("API /portfolio-contact POST error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// GET method to retrieve contacts for a portfolio owner
export async function GET(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;
        
        const url = new URL(request.url);
        const dataOwnerId = url.searchParams.get('dataOwnerId');
        
        if (!dataOwnerId) {
             return NextResponse.json({ error: 'Forbidden: dataOwnerId is required' }, { status: 403 });
        }

        let canAccess = false;
        if (authenticatedUserUid === dataOwnerId) {
            canAccess = true;
        } else {
            const memberDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
            if (memberDoc.exists && (memberDoc.data() as UserProfile).ownerId === dataOwnerId) {
                 const teamMemberDocRef = adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
                const teamMemberDocSnap = await teamMemberDocRef.get();
                if (teamMemberDocSnap.exists) {
                    const teamMemberData = teamMemberDocSnap.data() as TeamMember;
                    if (teamMemberData.permissions?.canManageCompanies) { // Reuse canManageCompanies perm
                        canAccess = true;
                    }
                }
            }
        }
        
        if (!canAccess) {
             return NextResponse.json({ error: 'Forbidden: You do not have permission to view contact requests.' }, { status: 403 });
        }

        const contactsSnapshot = await adminDb.collection('portfolioContacts')
            .where('portfolioOwnerId', '==', dataOwnerId)
            .get();
        
        let contacts: PortfolioContact[] = contactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PortfolioContact));
        
        // Manual sorting to avoid composite index
        contacts = contacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return NextResponse.json(contacts, { status: 200 });

    } catch (error: any) {
        console.error("API /portfolio-contact GET error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
