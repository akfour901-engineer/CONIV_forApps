


import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import { sendEmail } from '@/lib/email/server-only-index';
import type { AppConfiguration, EmailTemplate } from '@/types/server-only';
import { APP_NAME, DEFAULT_EMAIL_TEMPLATES } from '@/lib/constants';

const SendPurchaseConfirmationInputSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string().email(),
  packageName: z.string(),
  pointsAwarded: z.number(),
  amountPaid: z.number(),
  newBalance: z.number(),
  transactionId: z.string(),
});
type SendPurchaseConfirmationInput = z.infer<typeof SendPurchaseConfirmationInputSchema>;

const SendPurchaseConfirmationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
type SendPurchaseConfirmationOutput = z.infer<typeof SendPurchaseConfirmationOutputSchema>;

export async function sendPurchaseConfirmationEmail(input: SendPurchaseConfirmationInput): Promise<SendPurchaseConfirmationOutput> {
    const adminDb = getDb();
    
    try {
      let emailTemplate: EmailTemplate | undefined;
      let appNameForEmail = APP_NAME;

      try {
        const configDoc = await adminDb.collection("appConfiguration").doc("mainConfig").get();
        if (configDoc.exists) {
          const config = configDoc.data() as AppConfiguration;
          emailTemplate = config.emailTemplates?.purchaseConfirmation;
          appNameForEmail = config.appName || APP_NAME;
        }
      } catch (configError) {
          console.warn("Could not fetch app configuration for email. Falling back to defaults.");
      }

      // Fallback to default if template is not found in DB config
      if (!emailTemplate || !emailTemplate.subject || !emailTemplate.body) {
        emailTemplate = DEFAULT_EMAIL_TEMPLATES.purchaseConfirmation;
      }
      
      if (!input.userEmail) {
        throw new Error("User has no email address on record.");
      }

      let emailBody = emailTemplate.body
        .replace(/{USER_NAME}/g, input.userName)
        .replace(/{PACKAGE_NAME}/g, input.packageName)
        .replace(/{POINTS_AWARDED}/g, input.pointsAwarded.toString())
        .replace(/{AMOUNT_PAID}/g, `₹${input.amountPaid.toFixed(2)}`)
        .replace(/{NEW_BALANCE}/g, input.newBalance.toString())
        .replace(/{TRANSACTION_ID}/g, input.transactionId)
        .replace(/{APP_NAME}/g, appNameForEmail);

      const emailResult = await sendEmail({
        to: input.userEmail,
        subject: emailTemplate.subject.replace(/{APP_NAME}/g, appNameForEmail),
        body: emailBody,
        fromKey: 'support',
      });

      if (!emailResult.success) {
        throw new Error(emailResult.error || "Failed to send confirmation email via provider.");
      }
      
      return { success: true, message: "Confirmation email sent successfully." };

    } catch (error: any) {
      console.error(`[Flow: SendPurchaseConfirmationEmail] Error: ${error.message}`);
      return { success: false, message: error.message };
    }
}
