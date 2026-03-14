



import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import type { MailingListCampaign, MailingListContent, MailingListEntry, UserProfile, AppConfiguration } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { MAILING_LIST_EMAIL_SEND_COST } from '@/lib/constants';
import * as admin from 'firebase-admin';
import { sendEmail } from '@/lib/email/server-only-index';
import { APP_NAME } from '@/lib/constants';
import { marked } from 'marked';
export const dynamic = 'force-dynamic';

const campaignCreateSchema = z.object({
  dataOwnerId: z.string().min(1),
  campaignName: z.string().min(3, "Campaign name is required."),
  contentId: z.string().min(1, "Content selection is required."),
  mailingListIds: z.array(z.string()).min(1, "At least one mailing list must be selected."),
});

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

        if (decodedToken.uid !== dataOwnerId) {
             // In a real multi-tenant app, you'd check team permissions here
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const snapshot = await adminDb.collection('mailingListCampaigns').where('userId', '==', dataOwnerId).get();
        let campaigns: MailingListCampaign[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailingListCampaign));
        
        // Perform sorting in code to avoid needing a composite index
        campaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(campaigns, { status: 200 });

    } catch (error: any) {
        console.error("API /marketing/campaigns GET error:", error);
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
        const validationResult = campaignCreateSchema.safeParse(requestBody);
        if(!validationResult.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validationResult.error.flatten() }, { status: 400 });
        }
        const { dataOwnerId, campaignName, contentId, mailingListIds } = validationResult.data;

        if(actorUid !== dataOwnerId) {
            // Add team member check here if necessary
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const pointPayerProfileSnap = await adminDb.collection('users').doc(dataOwnerId).get();
        const contentSnap = await adminDb.collection('mailingListContent').doc(contentId).get();
        const appConfigSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
        
        if (!pointPayerProfileSnap.exists) {
            return NextResponse.json({ error: 'Data owner profile not found for point deduction' }, { status: 404 });
        }
        
        if (!contentSnap.exists) {
            return NextResponse.json({ error: 'Selected email content not found.' }, { status: 404 });
        }
        
        const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
        const contentData = contentSnap.data() as MailingListContent;
        
        const mailingListEntriesQuery = adminDb.collection('mailingList').where('userId', '==', dataOwnerId).where('mailingListIds', 'array-contains-any', mailingListIds);
        const entriesSnapshot = await mailingListEntriesQuery.get();
        const uniqueEmails = new Map<string, {name: string | null}>();
        entriesSnapshot.docs.forEach(doc => {
            const entry = doc.data() as MailingListEntry;
            if (entry.email) {
                uniqueEmails.set(entry.email, { name: entry.name || null });
            }
        });
        
        const totalEmailsToSend = uniqueEmails.size;
        if (totalEmailsToSend === 0) {
            return NextResponse.json({ error: "No contacts found in the selected mailing lists." }, { status: 400 });
        }

        let costPerEmail = MAILING_LIST_EMAIL_SEND_COST;
        if (appConfigSnap.exists) {
            const configData = appConfigSnap.data() as AppConfiguration;
            costPerEmail = configData.actionCosts?.find(c => c.key === 'MAILING_LIST_EMAIL_SEND_COST')?.cost ?? MAILING_LIST_EMAIL_SEND_COST;
        } else {
             console.warn("Could not load cost config for email sending.");
        }

        const totalCost = totalEmailsToSend * costPerEmail;
        if ((pointPayerProfileData.resourcePoints ?? 0) < totalCost) {
            return NextResponse.json({ error: `Insufficient points. This campaign requires ${totalCost} points to send to ${totalEmailsToSend} contacts.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
        }

        const now = new Date().toISOString();
        const newCampaignData: Omit<MailingListCampaign, 'id'> = {
            userId: dataOwnerId,
            createdByName: pointPayerProfileData.fullName || pointPayerProfileData.email!,
            createdAt: now,
            campaignName,
            contentId,
            mailingListIds,
            status: 'sending',
        };
        
        const docRef = await adminDb.collection('mailingListCampaigns').add(newCampaignData);

        // Log the initiation immediately
        await logActivity({
            ownerId: dataOwnerId,
            actorUid: actorUid,
            actorName: pointPayerProfileData.fullName || pointPayerProfileData.email!,
            actionType: 'mailing_list_campaign_sent',
            entityType: 'MailingListCampaign',
            entityId: docRef.id,
            entityName: campaignName,
            details: `Campaign "${campaignName}" initiated for ${totalEmailsToSend} contacts.`,
        });

        const emailPromises: Promise<any>[] = [];
        let successfulSends = 0;
        
        uniqueEmails.forEach((value, email) => {
            const emailBody = (contentData.htmlContent || '')
              .replace(/{{MEMBER_NAME}}/g, value.name || 'Valued Customer')
              .replace(/{{COMPANY_NAME}}/g, pointPayerProfileData.fullName || APP_NAME)
              .replace(/{{PRODUCT_LIST}}/g, ''); // Clear placeholder for now
              // Note: The above replace is a fallback. The AI should ideally place content where this placeholder is.

            const finalHtml = emailBody + `<br/><br/><p style="font-size: 10px; color: #888;">Sent via ${APP_NAME} on behalf of ${pointPayerProfileData.fullName || pointPayerProfileData.email}.</p>`;

            emailPromises.push(
                sendEmail({
                    to: email,
                    cc: pointPayerProfileData.email || undefined,
                    subject: contentData.subject,
                    body: finalHtml,
                    fromKey: 'noReply',
                    fromUserId: dataOwnerId,
                }).then(result => { if(result.success) successfulSends++; })
            );
        });

        await Promise.allSettled(emailPromises);
        
        const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
        const batch = adminDb.batch();
        batch.update(docRef, { status: 'sent', sentCount: successfulSends, failedCount: totalEmailsToSend - successfulSends, totalCost });
        if (totalCost > 0) {
            batch.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-totalCost) });
        }
        await batch.commit();

        return NextResponse.json({ id: docRef.id, ...newCampaignData, status: 'sent', sentCount: successfulSends, newResourcePoints: (pointPayerProfileData.resourcePoints ?? 0) - totalCost }, { status: 201 });

    } catch(error: any) {
        console.error("API /marketing/campaigns POST error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
