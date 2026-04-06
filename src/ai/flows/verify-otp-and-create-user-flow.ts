'use server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, UserNotificationPreferences } from '@/types/server-only';

import { 
  VerifyOtpAndCreateUserInputSchema, 
  VerifyOtpAndCreateUserOutputSchema 
} from '@/types/server-only';

import { DEFAULT_SIGNUP_RESOURCE_POINTS } from '@/lib/constants';

export const verifyOtpAndCreateUserFlow = ai.defineFlow(
  {
    name: 'verifyOtpAndCreateUserFlow',
    inputSchema: VerifyOtpAndCreateUserInputSchema,
    outputSchema: VerifyOtpAndCreateUserOutputSchema,
  },
  async ({ email, password, fullName, phoneNumber, emailOtp }) => {
    const defaultNotificationPrefs: UserNotificationPreferences = {
      importantUpdates: true, newMessages: true, invoicePaid: true, workOrderStatusAlerts: true,
      weeklyInvoiceFollowups: false, weeklySecurityDepositFollowups: false, weeklyFinancialSummary: false,
      weeklyLicensesDue: true, weeklyTopAlerts: true, marketplaceUpdates: true, newLoginAlerts: true,
      largeExpenseAlerts: true, projectBudgetWatch: true, profitabilityDipAlerts: true,
      lastWeeklyDigestSent: "Monday", preferredDigestDay: "Monday",
    };

    const adminDb = getDb();
    const adminAuth = getAuth();

    try {
      if (emailOtp) {
        const otpRef = adminDb.collection('otpTokens').doc(email);
        const otpSnap = await otpRef.get();

        if (!otpSnap.exists) return { success: false, error: 'No OTP found for this email. Please try signing up again.' };
        const otpData = otpSnap.data();
        if (otpData?.verified) return { success: false, error: 'This OTP has already been used.' };
        if (new Date() > new Date(otpData?.expiresAt)) return { success: false, error: 'This OTP has expired.' };
        if (otpData?.otp !== emailOtp) return { success: false, error: 'The email OTP you entered is incorrect.' };

        await otpRef.update({ verified: true });
      } else {
        return { success: false, error: 'Email OTP is required for signup.' };
      }

      const userRecord = await adminAuth.createUser({
        email, password, displayName: fullName, phoneNumber: phoneNumber || undefined, emailVerified: true,
      });

      const userProfile: UserProfile = {
        uid: userRecord.uid, email, fullName, phoneNumber: phoneNumber || null,
        dateCreated: new Date().toISOString(), lastLogin: new Date().toISOString(),
        lastPasswordChangeDate: new Date().toISOString(), resourcePoints: DEFAULT_SIGNUP_RESOURCE_POINTS,
        notificationPreferences: defaultNotificationPrefs, is2FAEnabled: false, isPinEnabled: false, appPin: null,
      };

      await adminDb.collection('users').doc(userRecord.uid).set(userProfile);

      return { success: true, userId: userRecord.uid };
    } catch (error: any) {
      console.error("Error in verifyOtpAndCreateUserFlow:", error);
      if (error.code?.startsWith('auth/')) return { success: false, error: error.message };
      return { success: false, error: error.message || 'An unexpected server error occurred.' };
    }
  }
);

export async function verifyOtpAndCreateUser(input: z.infer<typeof VerifyOtpAndCreateUserInputSchema>): Promise<z.infer<typeof VerifyOtpAndCreateUserOutputSchema>> {
  return await verifyOtpAndCreateUserFlow(input);
}