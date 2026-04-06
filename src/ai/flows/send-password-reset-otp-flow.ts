'use server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { sendEmail } from '@/lib/email/server-only-index';
import { APP_NAME } from '@/lib/constants';

import { 
  SendPasswordResetOtpInputSchema, 
  SendPasswordResetOtpOutputSchema 
} from '@/types/server-only';

export const sendPasswordResetOtpFlow = ai.defineFlow(
  {
    name: 'sendPasswordResetOtpFlow',
    inputSchema: SendPasswordResetOtpInputSchema,
    outputSchema: SendPasswordResetOtpOutputSchema,
  },
  async ({ email }) => {
    try {
      const adminDb = getDb();
      const adminAuth = getAuth();

      try {
        await adminAuth.getUserByEmail(email);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.warn(`Password reset requested for non-existent email: ${email}`);
          return { success: true, message: 'If an account with this email exists, a password reset code has been sent.' };
        }
        return { success: false, message: error.message || 'An unexpected error occurred.' };
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const otpRef = adminDb.collection('otpTokens').doc(email);
      await otpRef.set({
        otp,
        type: 'password_reset',
        expiresAt: expiresAt.toISOString(),
        verified: false,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      console.log(`[${new Date().toISOString()}] CONIV-AUTH-LOG: Generated password reset OTP for ${email} is: ${otp}`);

      const emailResult = await sendEmail({
        to: email,
        subject: `Your Password Reset Code for ${APP_NAME}`,
        fromKey: 'noReply',
        body: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #008080;">Password Reset Request for ${APP_NAME}</h2>
            <p>We received a request to reset the password for your account. Use the following one-time password (OTP) to proceed:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #005a5a; text-align: center; margin: 25px 0; padding: 15px; background-color: #f0fafa; border-radius: 5px;">${otp}</div>
            <p>This code will expire in 10 minutes.</p>
            <p style="margin-top: 20px;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            <br/><p>Best regards,<br/>The ${APP_NAME} Team</p>
          </div>
        </div>`,
      });

      if (!emailResult.success) {
        return { success: false, message: `Failed to send OTP email. ${emailResult.error || ''}`.trim() };
      }

      return { success: true, message: 'If an account with this email exists, a password reset code has been sent.' };
    } catch (error: any) {
      console.error("Unexpected error in sendPasswordResetOtpFlow:", error);
      return { success: false, message: error.message || 'An unexpected error occurred. Please try again.' };
    }
  }
);

export async function sendPasswordResetOtp(input: z.infer<typeof SendPasswordResetOtpInputSchema>): Promise<z.infer<typeof SendPasswordResetOtpOutputSchema>> {
  return await sendPasswordResetOtpFlow(input);
}