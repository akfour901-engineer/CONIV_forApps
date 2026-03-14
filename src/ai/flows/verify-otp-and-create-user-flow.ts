'use server';
/**
 * @fileOverview Verifies OTPs and creates a new user in both Firebase Auth and Firestore.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, UserNotificationPreferences } from '@/types/server-only';
import { DEFAULT_SIGNUP_RESOURCE_POINTS } from '@/lib/constants';

const VerifyOtpAndCreateUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phoneNumber: z.string().optional().nullable(),
  emailOtp: z.string().min(6).max(6).optional().nullable(),
  phoneOtp: z.string().min(6).max(6).optional().nullable(),
});

export const VerifyOtpAndCreateUserOutputSchema = z.object({
  success: z.boolean(),
  userId: z.string().optional(),
  error: z.string().optional(),
});


export async function verifyOtpAndCreateUser(input: z.infer<typeof VerifyOtpAndCreateUserInputSchema>): Promise<z.infer<typeof VerifyOtpAndCreateUserOutputSchema>> {
  
  const defaultNotificationPrefs: UserNotificationPreferences = {
    importantUpdates: true,
    newMessages: true,
    invoicePaid: true,
    workOrderStatusAlerts: true,
    weeklyInvoiceFollowups: false,
    weeklySecurityDepositFollowups: false,
    weeklyFinancialSummary: false,
    weeklyLicensesDue: true,
    weeklyTopAlerts: true,
    marketplaceUpdates: true,
    newLoginAlerts: true,
    largeExpenseAlerts: true,
    projectBudgetWatch: true,
    profitabilityDipAlerts: true,
    lastWeeklyDigestSent:"Monday",
    preferredDigestDay: "Monday",
  };


  const verifyOtpAndCreateUserFlow = ai.defineFlow(
    {
      name: 'verifyOtpAndCreateUserFlow',
      inputSchema: VerifyOtpAndCreateUserInputSchema,
      outputSchema: VerifyOtpAndCreateUserOutputSchema,
    },
    async ({ email, password, fullName, phoneNumber, emailOtp, phoneOtp }) => {
      const adminDb = getDb();
      const adminAuth = getAuth();

      try {
        // 1. Verify Email OTP
        if (emailOtp) {
          const otpRef = adminDb.collection('otpTokens').doc(email);
          const otpSnap = await otpRef.get();

          if (!otpSnap.exists) {
            throw new Error('No OTP found for this email. Please try signing up again.');
          }

          const otpData = otpSnap.data();
          if (otpData?.verified) throw new Error('This OTP has already been used.');
          if (new Date() > new Date(otpData?.expiresAt)) throw new Error('This OTP has expired.');
          if (otpData?.otp !== emailOtp) throw new Error('The email OTP you entered is incorrect.');
          
          // Mark OTP as verified to prevent reuse
          await otpRef.update({ verified: true });
        } else {
          throw new Error('Email OTP is required for signup.');
        }

        // 2. Create user in Firebase Authentication
        const userRecord = await adminAuth.createUser({
          email,
          password,
          displayName: fullName,
          phoneNumber: phoneNumber || undefined,
          emailVerified: true, // Since we just verified the OTP
        });

        // 3. Create user profile in Firestore
        const userProfile: UserProfile = {
          uid: userRecord.uid,
          email,
          fullName,
          phoneNumber: phoneNumber || null,
          dateCreated: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastPasswordChangeDate: new Date().toISOString(),
          resourcePoints: DEFAULT_SIGNUP_RESOURCE_POINTS,
          notificationPreferences: defaultNotificationPrefs,
          is2FAEnabled: false,
          isPinEnabled: false, 
          appPin: null,
        };

        await adminDb.collection('users').doc(userRecord.uid).set(userProfile);

        return { success: true, userId: userRecord.uid };

      } catch (error: any) {
        console.error("Error in verifyOtpAndCreateUserFlow:", error);
        
        // If user was created in Auth but Firestore failed, we should probably delete the Auth user.
        if (error.code?.startsWith('auth/')) {
          return { success: false, error: error.message };
        }
        
        return { success: false, error: error.message || 'An unexpected server error occurred.' };
      }
    }
  );
  return await verifyOtpAndCreateUserFlow(input);
}
