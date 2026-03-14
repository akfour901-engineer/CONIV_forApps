import { getDb } from '@/lib/firebase-admin-init';
import type { AppConfiguration, SystemEmails, EmailLog } from '@/types/server-only';
import { APP_NAME } from '../../lib/constants';
import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  body: string; // HTML or plain text
  cc?: string;
  fromKey?: keyof SystemEmails; // 'noReply' | 'support' | 'business' | 'contact' | 'info' | 'marketing'
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

const resend =
  process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'YOUR_RESEND_API_KEY'
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const adminDb = getDb();

async function logEmail(logData: Omit<EmailLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const logEntry = {
      ...logData,
      timestamp: new Date().toISOString(),
    };
    await adminDb.collection('emailLogs').add(logEntry);
  } catch (error) {
    console.error('Failed to log email to Firestore:', error);
    // non-fatal → we continue even if logging fails
  }
}

export async function sendEmail(
  options: EmailOptions,
): Promise<{ success: boolean; error?: string }> {
  let systemEmails = DEFAULT_SYSTEM_EMAILS;
  let appName = APP_NAME;

  // Try to load custom configuration from Firestore
  try {
    const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();

    if (configDoc.exists) {
      const config = configDoc.data() as AppConfiguration;
      // Merge: config values override defaults
      systemEmails = {
        ...DEFAULT_SYSTEM_EMAILS,
        ...config.systemEmails,
      };
      appName = config.appName || APP_NAME;
    }
  } catch (err) {
    console.warn('Could not fetch app configuration → using defaults', err);
  }

  const fromKey = options.fromKey || 'noReply';
  const fromEmail = systemEmails[fromKey];

  // Safety check – prevent sending from undefined address
  if (!fromEmail) {
    const msg = `No email address found for key: "${fromKey}"`;
    console.error(msg);
    await logEmail({
      from: 'system-error@invalid',
      to: options.to,
      subject: options.subject,
      status: 'failed',
      error: msg,
      fromUserId: options.fromUserId,
    });
    return { success: false, error: msg };
  }

  const fromAddress = `The ${appName} Team <${fromEmail}>`;

  // Development / missing key simulation mode
  if (!resend) {
    console.warn('RESEND_API_KEY not set or is placeholder → simulating email send');

    console.log('╔══════════════════════════════════════╗');
    console.log('║          SIMULATED EMAIL SEND        ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`  From:    ${fromAddress}`);
    console.log(`  To:      ${options.to}`);
    if (options.cc) console.log(`  CC:      ${options.cc}`);
    console.log(`  Subject: ${options.subject}`);
    console.log('╚══════════════════════════════════════╝');

    await logEmail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      status: 'simulated',
      fromUserId: options.fromUserId,
    });

    return { success: true };
  }

  // Real send via Resend
  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [options.to],
      cc: options.cc ? [options.cc] : undefined,
      subject: options.subject,
      html: options.body,
    });

    if (error) {
      console.error('Resend API error:', error);
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

    console.log(`Email sent successfully to ${options.to}`, data?.id);

    await logEmail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      status: 'sent',
      fromUserId: options.fromUserId,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send email via Resend:', err);
    await logEmail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      status: 'failed',
      error: err.message || String(err),
      fromUserId: options.fromUserId,
    });
    return { success: false, error: err.message || 'Unknown sending error' };
  }
}