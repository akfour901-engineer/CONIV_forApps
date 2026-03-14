'use server';

import { Resend } from 'resend';
import type { AppConfiguration, SystemEmails, EmailLog } from '@/types/server-only';
import { APP_NAME } from '../constants';
import { getDb } from '@/lib/firebase-admin-init';

interface EmailOptions {
  to: string;
  subject: string;
  body: string; // HTML or plain text
  cc?: string;
  fromKey?: keyof SystemEmails; // 'noReply', 'support', 'business'
  fromUserId?: string; // UID of the user on whose behalf the email is sent
}

const DEFAULT_SYSTEM_EMAILS: SystemEmails = {
    noReply: "noreply@coniv.in",
    support: "support@coniv.in",
    business: "business@coniv.in",
    contact: "contact@coniv.in",
    info: "info@coniv.in",
    marketing: "marketing@coniv.in"

};

const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "YOUR_RESEND_API_KEY"
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
  
const adminDb = getDb();

async function logEmail(logData: Omit<EmailLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const logEntry: Omit<EmailLog, 'id'> = {
      ...logData,
      timestamp: new Date().toISOString(),
    };
    await adminDb.collection('emailLogs').add(logEntry);
  } catch (error) {
    console.error("Failed to log email to Firestore:", error);
    // Do not throw error, as email sending is the primary function
  }
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  
  let systemEmails = DEFAULT_SYSTEM_EMAILS;
  let appName = APP_NAME;

  try {
    const configDoc = await adminDb.collection("appConfiguration").doc("mainConfig").get();
    if (configDoc.exists) {
      const config = configDoc.data() as AppConfiguration;
      systemEmails = { ...DEFAULT_SYSTEM_EMAILS, ...(config.systemEmails || {}) };
      appName = config.appName || APP_NAME;
    }
  } catch(e) {
    console.warn("Could not fetch system emails from config, using defaults.");
  }
  
  const fromKey = options.fromKey || 'noReply';
  const fromEmail = systemEmails[fromKey];
  const fromAddress = `The ${appName} Team <${fromEmail}>`;

  if (!resend) {
    console.warn("Resend API key is not configured or is a placeholder. Simulating email send.");
    console.log("--- SIMULATING EMAIL SEND ---");
    console.log(`From: ${fromAddress}`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log("--- END OF SIMULATION ---");
    
    await logEmail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        status: 'simulated',
        fromUserId: options.fromUserId,
    });
    
    return { success: true }; 
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [options.to], 
      cc: options.cc,
      subject: options.subject,
      html: options.body,
    });

    if (error) {
      console.error("Resend API error:", error);
      await logEmail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        status: 'failed',
        error: error.message,
        fromUserId: options.fromUserId,
      });
      return { success: false, error: error.message };
    }

    console.log(`Email sent successfully via Resend to: ${options.to}`, data);
    await logEmail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        status: 'sent',
        fromUserId: options.fromUserId,
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send email via Resend:", error);
    await logEmail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        status: 'failed',
        error: error.message,
        fromUserId: options.fromUserId,
    });
    return { success: false, error: error.message };
  }
}
