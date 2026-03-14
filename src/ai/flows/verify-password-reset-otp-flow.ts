
'use server';
/**
 * @fileOverview Verifies a password reset OTP and returns a short-lived token for the final reset step.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import { v4 as uuidv4 } from 'uuid';
import { VerifyPasswordResetOtpInputSchema, VerifyPasswordResetOtpOutputSchema as LocalVerifyPasswordResetOtpOutputSchema } from '@/types/server-only';

export const VerifyPasswordResetOtpOutputSchema = LocalVerifyPasswordResetOtpOutputSchema;

const verifyPasswordResetOtpFlow = ai.defineFlow(
    {
      name: 'verifyPasswordResetOtpFlow',
      inputSchema: VerifyPasswordResetOtpInputSchema,
      outputSchema: VerifyPasswordResetOtpOutputSchema,
    },
    async ({ email, otp }) => {
      const adminDb = getDb();
      try {
        const otpRef = adminDb.collection('otpTokens').doc(email);
        const otpSnap = await otpRef.get();

        if (!otpSnap.exists) {
          return { success: false, error: 'Invalid OTP. Please request a new one.' };
        }

        const otpData = otpSnap.data();

        if (otpData?.verified) {
          return { success: false, error: 'This OTP has already been used.' };
        }
        if (otpData?.type !== 'password_reset') {
            return { success: false, error: 'This OTP is not valid for a password reset.' };
        }
        if (new Date() > new Date(otpData?.expiresAt)) {
          return { success: false, error: 'This OTP has expired. Please request a new one.' };
        }
        if (otpData?.otp !== otp) {
          return { success: false, error: 'The OTP you entered is incorrect.' };
        }

        // OTP is valid. Mark it as verified and generate a single-use token.
        const resetToken = uuidv4();
        const tokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry for the reset token
        
        await otpRef.update({ 
            verified: true,
            resetToken: resetToken,
            resetTokenExpiresAt: tokenExpiresAt.toISOString(),
        });

        return { success: true, token: resetToken };
      } catch (error: any) {
        console.error("Error in verifyPasswordResetOtpFlow:", error);
        return { success: false, error: 'An unexpected server error occurred during OTP verification.' };
      }
    }
);
  
export async function verifyPasswordResetOtp(input: z.infer<typeof VerifyPasswordResetOtpInputSchema>): Promise<z.infer<typeof VerifyPasswordResetOtpOutputSchema>> {
  return await verifyPasswordResetOtpFlow(input);
}
