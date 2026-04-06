'use server';
/**
 * @fileOverview Resets a user's password after successful OTP and token verification.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb, getAuth } from '@/lib/firebase-admin-init';

import { 
  ResetPasswordWithTokenInputSchema, 
  ResetPasswordWithTokenOutputSchema 
} from '@/types/server-only';

const resetPasswordWithTokenFlow = ai.defineFlow(
  {
    name: 'resetPasswordWithTokenFlow',
    inputSchema: ResetPasswordWithTokenInputSchema,
    outputSchema: ResetPasswordWithTokenOutputSchema,
  },
  async ({ email, token, newPassword }) => {
    const adminDb = getDb();
    const adminAuth = getAuth();
    
    try {
      const otpRef = adminDb.collection('otpTokens').doc(email);
      const otpSnap = await otpRef.get();

      if (!otpSnap.exists) {
        return { success: false, error: 'Invalid session. Please start the password reset process again.' };
      }
      
      const otpData = otpSnap.data();

      if (otpData?.resetToken !== token) {
        return { success: false, error: 'Invalid or expired reset token.' };
      }
      if (new Date() > new Date(otpData?.resetTokenExpiresAt)) {
        return { success: false, error: 'Your password reset session has expired. Please try again.' };
      }
      
      const userRecord = await adminAuth.getUserByEmail(email);
      
      await adminAuth.updateUser(userRecord.uid, { password: newPassword });

      await adminDb.collection('users').doc(userRecord.uid).set({
        lastPasswordChangeDate: new Date().toISOString(),
      }, { merge: true });

      await otpRef.delete();
      
      return { success: true };
    } catch (error: any) {
      console.error("Error in resetPasswordWithTokenFlow:", error);
      if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'No user found with this email address.' };
      }
      if (error.code === 5) {
        console.error("Firestore 'NOT_FOUND' error.");
        return { success: true };
      }
      return { success: false, error: error.message || 'An unexpected server error occurred.' };
    }
  }
);

export async function resetPasswordWithToken(input: z.infer<typeof ResetPasswordWithTokenInputSchema>): Promise<z.infer<typeof ResetPasswordWithTokenOutputSchema>> {
  return await resetPasswordWithTokenFlow(input);
}