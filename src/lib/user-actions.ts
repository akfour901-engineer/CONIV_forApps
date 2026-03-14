import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile, UserNotificationPreferences } from '@/types';
import { DEFAULT_SIGNUP_RESOURCE_POINTS } from './constants';

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
    preferredDigestDay: 'Monday',
    lastWeeklyDigestSent:'Monday'
};

// This function is intended to be called from the client-side after a user
// has been successfully created via Firebase Auth.
export async function createUserProfile(uid: string, email: string, fullName: string, phoneNumber: string | null) {
    if (!db) {
        throw new Error("Firestore is not initialized.");
    }

    const userProfile: UserProfile = {
        uid,
        email: email,
        fullName: fullName,
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

    try {
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, userProfile);
        console.log("User profile created in Firestore for UID:", uid);
    } catch (error) {
        console.error("Error creating user profile in Firestore:", error);
        // In a real app, you might want to delete the auth user here if the profile creation fails
        // to prevent orphaned auth accounts.
        throw new Error("Failed to create user profile in the database.");
    }
}
