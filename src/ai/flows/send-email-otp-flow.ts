'use server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { sendEmail } from '@/lib/email/server-only-index';
import { APP_NAME } from '@/lib/constants';

import { SendEmailOtpOutputSchema } from '@/types/server-only';

const SendEmailOtpInputSchema = z.object({ email: z.string().email() });

export const sendEmailOtpFlow = ai.defineFlow(
  {
    name: 'sendEmailOtpFlow',
    inputSchema: SendEmailOtpInputSchema,
    outputSchema: SendEmailOtpOutputSchema,
  },
  async ({ email }) => {
    try {
      const adminAuth = getAuth();

      try {
        await adminAuth.getUserByEmail(email);
        return { success: false, message: "An account with this email already exists. Please sign in." };
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          return { success: false, message: error.message || "An unexpected error occurred." };
        }
      }

      const adminDb = getDb();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const otpRef = adminDb.collection('otpTokens').doc(email);
      await otpRef.set({ otp, expiresAt: expiresAt.toISOString(), verified: false, createdAt: new Date().toISOString() });

      console.log(`[${new Date().toISOString()}] CONIV-AUTH-LOG: Generated OTP for ${email} is: ${otp}`);

      const emailBody = `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to ${APP_NAME}!</h2>
        <p>Thank you for signing up. Please use the following one-time password (OTP) to complete your registration:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #008080;">${otp}</p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this code, you can safely ignore this email.</p>
        <br/><p>Best regards,<br/>The ${APP_NAME} Team</p>
      </div>`;

      const emailResult = await sendEmail({ 
        to: email, 
        subject: `Your Verification Code for ${APP_NAME}`, 
        body: emailBody, 
        fromKey: 'noReply' 
      });

      if (!emailResult.success) {
        return { success: false, message: `Failed to send OTP email. ${emailResult.error || ''}`.trim() };
      }

      return { success: true, message: 'An OTP has been sent to your email address.' };
    } catch (error: any) {
      console.error("Unexpected error in sendEmailOtpFlow:", error);
      return { success: false, message: error.message || 'An unexpected error occurred. Please try again.' };
    }
  }
);

export async function sendEmailOtp(input: { email: string }): Promise<z.infer<typeof SendEmailOtpOutputSchema>> {
  return await sendEmailOtpFlow(input);
}