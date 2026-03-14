'use server';
/**
 * @fileOverview A flow to send SMS alerts to users based on their notification preferences.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import { sendSms } from '@/lib/sms/server-only-index';
import type { UserProfile } from '@/types/server-only';

export const SendSmsAlertInputSchema = z.object({
    userId: z.string().describe("The ID of the user to send the alert to."),
    message: z.string().min(1, "Message content cannot be empty."),
    notificationType: z.string().describe("The type of notification, to check against user preferences."),
});
export type SendSmsAlertInput = z.infer<typeof SendSmsAlertInputSchema>;

export const SendSmsAlertOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});
export type SendSmsAlertOutput = z.infer<typeof SendSmsAlertOutputSchema>;

const sendSmsAlertFlow = ai.defineFlow(
    {
        name: 'sendSmsAlertFlow',
        inputSchema: SendSmsAlertInputSchema,
        outputSchema: SendSmsAlertOutputSchema,
    },
    async ({ userId, message, notificationType }) => {
        const adminDb = getDb();
        try {
            const userRef = adminDb.collection('users').doc(userId);
            const userSnap = await userRef.get();

            if (!userSnap.exists) {
                return { success: false, message: `User with ID ${userId} not found.` };
            }

            const userProfile = userSnap.data() as UserProfile;

            // Check if user has sufficient points for alerts
            if ((userProfile.resourcePoints ?? 0) < 700) {
                 return { success: false, message: `User has insufficient points for notifications.` };
            }

            // Check if user has opted-in for this specific type of SMS alert
            const canSendSms = (userProfile.notificationPreferences as any)?.[notificationType] === true;
            
            if (!canSendSms) {
                return { success: false, message: `User has not opted-in for '${notificationType}' SMS alerts.` };
            }

            if (!userProfile.phoneNumber) {
                 return { success: false, message: 'User does not have a phone number on file.' };
            }
            
            const smsResult = await sendSms({
                to: userProfile.phoneNumber,
                body: message,
            });

            if (!smsResult.success) {
                throw new Error(smsResult.error || "Failed to send SMS via provider.");
            }

            return { success: true, message: "SMS alert sent successfully." };

        } catch (error: any) {
            console.error("Error in sendSmsAlertFlow:", error);
            return { success: false, message: error.message || "An unexpected error occurred." };
        }
    }
);

export async function sendSmsAlert(input: SendSmsAlertInput): Promise<SendSmsAlertOutput> {
    return await sendSmsAlertFlow(input);
}
