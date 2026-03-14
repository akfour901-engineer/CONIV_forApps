'use server';
/**
 * @fileOverview A flow to verify email OTPs.
 * This flow checks the provided OTP against the stored token in Firestore.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';

export const VerifyEmailOtpInputSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
});

export const VerifyEmailOtpOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

const verifyEmailOtpFlow = ai.defineFlow(
    {
      name: 'verifyEmailOtpFlow',
      inputSchema: VerifyEmailOtpInputSchema,
      outputSchema: VerifyEmailOtpOutputSchema,
    },
    async ({ email, otp }) => {
      const adminDb = getDb();
      try {
        const otpRef = adminDb.collection('otpTokens').doc(email);
        const otpSnap = await otpRef.get();

        if (!otpSnap.exists) {
          return { success: false, error: 'No OTP found for this email. Please try again.' };
        }

        const otpData = otpSnap.data();

        if (otpData?.verified) {
          return { success: false, error: 'This OTP has already been used.' };
        }

        if (new Date() > new Date(otpData?.expiresAt)) {
          return { success: false, error: 'This OTP has expired. Please request a new one.' };
        }

        if (otpData?.otp !== otp) {
          return { success: false, error: 'The OTP you entered is incorrect.' };
        }

        // Mark OTP as verified
        await otpRef.update({ verified: true });

        return { success: true };
      } catch (error: any) {
        console.error("Error in verifyEmailOtpFlow:", error);
        return { success: false, error: 'An unexpected server error occurred during OTP verification.' };
      }
    }
);
  
export async function verifyEmailOtp(input: z.infer<typeof VerifyEmailOtpInputSchema>): Promise<z.infer<typeof VerifyEmailOtpOutputSchema>> {
  return await verifyEmailOtpFlow(input);
}
