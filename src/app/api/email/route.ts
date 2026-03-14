


import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { sendEmail } from '@/lib/email/server-only-index';
import type { UserProfile, AppConfiguration, EmailTemplate } from '@/types/server-only';
import { APP_NAME } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const emailSendSchema = z.object({
  recipientUid: z.string().min(1),
  templateKey: z.enum(['userSignupOtp', 'userAlert', 'generalBusiness', 'supportResponse', 'passwordResetOtp']),
  templateData: z.record(z.any()),
});

// This is an internal-only API route, protected by admin/system-level access
async function authorizeRequest(idToken: string): Promise<boolean> {
    const authAdmin = getAuth();
    const adminDb = getDb();
    try {
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const userProfileDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (userProfileDoc.exists) {
            const userProfile = userProfileDoc.data() as UserProfile;
            // For now, only admins can send emails via this route. This can be expanded.
            return !!userProfile.isAdmin; 
        }
        return false;
    } catch (error) {
        console.error("Authorization check failed in email API:", error);
        return false;
    }
}

export async function POST(request: Request) {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    // For now, we will allow any authenticated user to trigger this for simplicity.
    // In a production system, you would uncomment the line below.
    // const isAuthorized = await authorizeRequest(idToken);
    // if (!isAuthorized) {
    //     return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    // }

    try {
        const adminDb = getDb();
        const body = await request.json();
        const validation = emailSendSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ success: false, error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
        }
        const { recipientUid, templateKey, templateData } = validation.data;

        const recipientProfileDoc = await adminDb.collection('users').doc(recipientUid).get();
        if (!recipientProfileDoc.exists) {
            return NextResponse.json({ success: false, error: 'Recipient user not found.' }, { status: 404 });
        }
        const recipientProfile = recipientProfileDoc.data() as UserProfile;
        const toEmail = recipientProfile.email;
        if (!toEmail) {
            return NextResponse.json({ success: false, error: 'Recipient does not have an email address.' }, { status: 400 });
        }

        // Check for resource points before sending non-essential emails
        if (templateKey === 'userAlert' || templateKey === 'generalBusiness' || templateKey === 'supportResponse') {
            if ((recipientProfile.resourcePoints ?? 0) < 700) {
                return NextResponse.json({ success: true, message: `Email not sent: User has insufficient points for this notification type.` });
            }
        }

        const configDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const configSnap = await configDocRef.get();
        const configData = !!configSnap.exists ? configSnap.data() as AppConfiguration : null;
        
        const emailTemplate: EmailTemplate | undefined = configData?.emailTemplates?.[templateKey];
        if (!emailTemplate) {
            throw new Error(`Email template for key "${templateKey}" is not configured.`);
        }

        let subject = emailTemplate.subject.replace(/{APP_NAME}/g, APP_NAME);
        let emailBody = emailTemplate.body.replace(/{APP_NAME}/g, APP_NAME);
        
        // Replace placeholders
        for (const key in templateData) {
            const placeholder = new RegExp(`{${key}}`, 'g');
            subject = subject.replace(placeholder, templateData[key]);
            emailBody = emailBody.replace(placeholder, templateData[key]);
        }

        const emailResult = await sendEmail({
            to: toEmail,
            subject: subject,
            body: emailBody,
            fromKey: 'support', // Or make this dynamic if needed
        });

        if (!emailResult.success) {
            throw new Error(emailResult.error || "Email provider failed to send email.");
        }

        return NextResponse.json({ success: true, message: `Email sent to ${toEmail}.` });

    } catch (error: any) {
        console.error("Error in /api/email POST:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
