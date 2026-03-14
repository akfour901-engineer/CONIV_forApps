// src/jobs/weekly-digest-cron.ts
'use server';

import cron from 'node-cron';
import { getDb } from '@/lib/firebase-admin-init';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Asia/Kolkata';

/**
 * Checks if a user has any digest notification category enabled.
 */
function userWantsAnyDigest(prefs: any): boolean {
  if (!prefs) return false;
  return !!(
    prefs.weeklyTopAlerts ||
    prefs.weeklyInvoiceFollowups ||
    prefs.weeklySecurityDepositFollowups ||
    prefs.weeklyFinancialSummary ||
    prefs.weeklyLicensesDue ||
    prefs.marketplaceUpdates ||
    prefs.workOrderStatusAlerts ||
    prefs.projectBudgetWatch ||
    prefs.profitabilityDipAlerts ||
    prefs.largeExpenseAlerts
  );
}

// Prevents multiple instances from running at the same time
let isRunning = false;
let isRegistered = false;

export async function registerWeeklyDigestCron() {
  if (isRegistered) return;

  /**
   * Schedule: Runs every hour on the hour between 8:00 AM and 8:00 PM IST.
   * This window covers the main business day while reducing unnecessary load at night.
   */
  cron.schedule(
    '0 8-20 * * *',
    async () => {
      if (isRunning) {
        console.log('[Cron: WeeklyDigest] Already running, skipping this execution slot.');
        return;
      }

      const now = new Date();
      const todayDayName = formatInTimeZone(now, TIMEZONE, 'EEEE');
      const todayStr = formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd');

      console.log(`[Cron: WeeklyDigest] Starting execution at ${now.toISOString()} (${todayDayName})`);

      // Skip weekends as digest emails are generally for work-week planning
      if (['Saturday', 'Sunday'].includes(todayDayName)) {
        console.log(`[Cron: WeeklyDigest] Skipping weekend execution.`);
        return;
      }

      try {
        isRunning = true;
        const db = getDb();

        // Query for users whose preferred day is TODAY.
        const usersSnap = await db
          .collection('users')
          .where('notificationPreferences.preferredDigestDay', '==', todayDayName)
          .limit(30)
          .get();

        if (usersSnap.empty) {
          console.log('[Cron: WeeklyDigest] No users scheduled for a digest on this day/hour.');
          return;
        }

        console.log(`[Cron: WeeklyDigest] Found ${usersSnap.size} potentially eligible users.`);

        // Lazy load the AI flow to prevent initialization errors
        const { sendWeeklyEmailDigest } = await import('@/ai/flows/send-weekly-email-digest-flow');

        let processedCount = 0;
        let sentCount = 0;
        let skippedCount = 0;

        for (const doc of usersSnap.docs) {
          const userId = doc.id;
          const userData = doc.data();
          const prefs = userData.notificationPreferences || {};

          if (prefs.lastWeeklyDigestSent === todayStr) {
            skippedCount++;
            continue;
          }

          if (!userWantsAnyDigest(prefs)) {
            skippedCount++;
            continue;
          }

          try {
            const result = await sendWeeklyEmailDigest({ userId });
            
            if (result.emailSent) {
              sentCount++;
              console.log(`[Cron: WeeklyDigest] Sent successfully to ${userId}`);
            } else {
              console.log(`[Cron: WeeklyDigest] User ${userId} skipped: ${result.message}`);
              skippedCount++;
            }
          } catch (error: any) {
            console.error(`[Cron: WeeklyDigest] Error processing user ${userId}:`, error.message || error);
          }

          processedCount++;
          
          // Pacing: Wait 2 seconds between users
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`[Cron: WeeklyDigest] Cycle Complete. Sent: ${sentCount}, Skipped: ${skippedCount}, Total Processed: ${processedCount}`);

      } catch (error: any) {
        console.error('[Cron: WeeklyDigest] FATAL ERROR during execution:', error.message || error);
      } finally {
        isRunning = false;
      }
    },
    {
      timezone: TIMEZONE,
    }
  );

  isRegistered = true;
  console.log(`[Cron: WeeklyDigest] Service initialized for ${TIMEZONE} (8 AM - 8 PM IST window).`);
}
