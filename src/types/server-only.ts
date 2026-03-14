

import { z } from 'zod';
//import { registerWeeklyDigestCron } from '@/jobs/weekly-digest-cron';

//registerWeeklyDigestCron();

// Re-export safe constants from lib/constants
export * from '@/lib/constants';

// ────────────────────────────────────────────────
// Core App Configuration Interfaces & Constants
export interface AppConfigActionCost {
  key: string;
  label: string;
  cost: number;
}

export interface AppConfigCoinPurchasePackage {
  id: string;
  name: string;
  amount: number;
  points: number;
  description: string;
}

export interface SystemEmails {
  noReply: string;
  support: string;
  business: string;
  contact: string;
  info: string;
  marketing: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailTemplates {
  userSignupOtp: EmailTemplate;
  passwordResetOtp: EmailTemplate;
  purchaseConfirmation: EmailTemplate;
  userAlert: EmailTemplate;
  generalBusiness: EmailTemplate;
  supportResponse: EmailTemplate;
  weeklyTopAlerts: EmailTemplate;
  weeklyInvoiceFollowups: EmailTemplate;
  weeklySecurityDepositFollowups: EmailTemplate;
  weeklyFinancialSummary: EmailTemplate;
  weeklyLicensesDue: EmailTemplate;
}

export interface SocialLinks {
  youtube?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
}

export interface TemporaryBanner {
  id: string;
  message: string;
  title: string;
  enabled: boolean;
  link?: string;
  validUntil?: string;
  isRewardBanner?: boolean;
  rewardPoints?: number;
}

export interface AppConfiguration {
  appName: string;
  defaultSignupResourcePoints: number;
  actionCosts?: AppConfigActionCost[];
  coinPurchasePackages?: AppConfigCoinPurchasePackage[];
  systemEmails?: SystemEmails;
  emailTemplates?: Partial<EmailTemplates>;
  socialLinks?: SocialLinks;
  temporaryBanners?: TemporaryBanner[];
  termsAndConditionsContent?: string;
  privacyPolicyContent?: string;
  mobileAppUrl?: string | null;
  desktopAppUrl?: string | null;
  razorpayKeyId?: string | null;
  razorpayKeySecret?: string | null;
  defaultTermsAndConditions?: string;
  defaultTaxRate?: number;
  defaultPasswordChangeDays?: number | null;
  defaultPinChangeDays?: number | null;
  featureFlags?: {
    isMarketplaceEnabled?: boolean;
    isAiToolsEnabled?: boolean;
  };
  defaultSorVisibility?: 'public' | 'private';
  supportContactPhone?: string | null;
}

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  color?: string;
  children?: NavItem[];
  isAdmin?: boolean;
  isInstallButton?: boolean;
}

// ────────────────────────────────────────────────
// Constants from reference (costs, packages, emails, templates, terms)
export const ACTION_COSTS_DISPLAY: Omit<AppConfigActionCost, 'cost'>[] = [
  { key: "DAILY_CHECK_IN_REWARD", label: "Daily Check-in Reward" },
  { key: "COMPANY_CREATION_COST", label: "Company Creation" },
  { key: "BANK_ACCOUNT_CREATION_COST", label: "Bank Account Setup" },
  { key: "ORGANIZATION_CREATION_COST", label: "Organization/Client Creation" },
  { key: "FOLLOW_UP_CREATION_COST", label: "Follow-up/Reminder Creation" },
  { key: "ESTIMATE_CREATION_COST", label: "Estimate Creation" },
  { key: "WORK_ORDER_CREATION_COST", label: "Work Order Creation" },
  { key: "INVOICE_CREATION_COST", label: "Invoice Creation" },
  { key: "LABOUR_ENTRY_CREATION_COST", label: "Labour Entry (per worker added)" },
  { key: "DOCUMENT_LINKING_COST", label: "Document Upload/Linking" },
  { key: "PURCHASE_ORDER_CREATION_COST", label: "Purchase Order Creation" },
  { key: "PO_COMMIT_TO_EXPENSE_COST", label: "PO: Commit as Expense" },
  { key: "INVENTORY_ITEM_CREATION_COST", label: "Inventory Item Creation" },
  { key: "INVENTORY_TRANSACTION_COST", label: "Inventory Transaction (Issue/Receive)" },
  { key: "LICENSE_CREATION_COST", label: "License Creation" },
  { key: "SOR_RATE_CREATION_COST", label: "SOR Rate Creation (Private)" },
  { key: "EXPENSE_RECORDING_COST", label: "Expense Recording (Manual)" },
  { key: "LABOUR_PAYMENT_RECORDING_COST", label: "Labour Advance/Payment Recording" },
  { key: "DIGITAL_BUSINESS_CARD_CREATION_COST", label: "Digital Business Card Creation" },
  { key: "MARKETPLACE_LISTING_CREATION_COST", label: "Marketplace Listing Creation" },
  { key: "TEAM_INVITATION_COST", label: "Team Invitation Sent" },
  { key: "TIME_TRACKING_LOG_COST", label: "Daily Time Tracking Log (per worker)" },
  { key: "DPR_CREATION_COST", label: "Daily Progress Report (DPR) Creation" },
  { key: "SERVICE_VISIT_REPORT_CREATION_COST", label: "Service Visit Report (SVR) Creation" },
  { key: 'MAILING_LIST_ADDITION_COST', label: 'Mailing List Contact Addition' },
  { key: 'MAILING_LIST_MEMBERSHIP_COST', label: 'Mailing List Membership Change' },
  { key: 'MAILING_LIST_EMAIL_SEND_COST', label: 'Mailing List Email (per recipient)' },
  { key: "AI_ESTIMATE_SUGGESTION_COST", label: "AI: Estimate Item Suggestion" },
  { key: "AI_DOCUMENT_ANALYSIS_COST", label: "AI: Document Analysis (OCR)" },
  { key: "AI_RISK_ASSESSMENT_COST", label: "AI: Risk Assessment (Estimates/WOs)" },
  { key: "AI_AUDIT_TOOL_BASE_COST", label: "AI: Audit Tool (Base cost per run)" },
  { key: "LETTER_CERTIFICATE_GENERATION_COST", label: "AI: Letter/Certificate Generation" },
  { key: "AI_PORTFOLIO_GENERATION_COST", label: "AI: Portfolio Generation" },
  { key: 'WEEKLY_EMAIL_DIGEST_COST', label: 'Weekly Email Digest' },
  { key: 'PIN_SETUP_COST', label: 'PIN Setup' },
  { key: 'TWO_FA_ENABLE_COST', label: '2FA Setup' },
  { key: 'TASK_CREATION_COST', label: 'Task Creation (Gantt)' },
  { key: 'CHAT_MESSAGE_COST', label: 'Chat Message (per message)' },
  { key: 'SUBCONTRACTOR_CREATION_COST', label: 'Subcontractor Creation' },
  { key: "AI_WO_ANALYSIS_COST", label: "AI: Work Order Analysis" },
  { key: "AI_FINANCIAL_HEALTH_COST", label: "AI: Financial Health Check" },
  { key: "AI_LABOR_ANALYSIS_COST", label: "AI: Labor Analysis" },
  { key: "AI_BID_ADVISOR_COST", label: "AI: Bid/No-Bid Advisor" },
  { key: "AI_SAFETY_COMPLIANCE_COST", label: "AI: Safety Compliance Officer" },
  { key: "AI_PROJECT_SCHEDULER_COST", label: "AI: Project Scheduler" },
  { key: "AI_CASH_FLOW_FORECASTER_COST", label: "AI: Cash Flow Forecaster" },
  { key: "AI_SMART_COLLECTIONS_COST", label: "AI: Smart Collections Agent" },
  { key: "AI_FRAUD_DETECTOR_COST", label: "AI: Fraud Detector" },
  { key: "AI_EXPENSE_ANOMALY_COST", label: "AI: Expense Anomaly Detection" },
  { key: "AI_MATERIALS_FORECASTER_COST", label: "AI: Materials Forecaster" },
  { key: "AI_TEAM_PERFORMANCE_COST", label: "AI: Team Performance Analyst" },
  { key: "AI_AUDIT_TOOL_Q_AND_A_COST", label: "AI: Q&A Auditor" },
  { key: "AI_DAILY_BRIEFING_COST", label: "AI: Daily Briefing" },
  { key: "AI_MARKETING_CONTENT_GENERATION_COST", label: "AI: Marketing Content Generation"},
  { key: 'PORTFOLIO_CONTACT_REQUEST_COST', label: 'Portfolio Contact Request' },
];

export const DEFAULT_COIN_PURCHASE_PACKAGES: AppConfigCoinPurchasePackage[] = [
  { id: 'pack_49', name: 'Starter Pack', amount: 49, points: 300, description: 'Get 300 Points for ₹49' },
  { id: 'pack_99', name: 'Value Pack', amount: 99, points: 1000, description: 'Get 1000 Points for ₹99' },
  { id: 'pack_299', name: 'Pro Pack', amount: 299, points: 3500, description: 'Get 3500 Points for ₹299' },
  { id: 'pack_499', name: 'Business Pack', amount: 499, points: 7000, description: 'Get 7000 Points for ₹499' },
  { id: 'pack_999', name: 'Enterprise Pack', amount: 999, points: 15000, description: 'Get 15000 Points for ₹999' },
  { id: 'pack_1999', name: 'Power User Pack', amount: 1999, points: 32000, description: 'Get 32000 Points for ₹1999' },
  { id: 'pack_3999', name: 'Agency Pack', amount: 3999, points: 65000, description: 'Get 65000 Points for ₹3999' },
];

export const DEFAULT_SYSTEM_EMAILS: SystemEmails = {
  noReply: "noreply@coniv.in",
  support: "support@coniv.in",
  business: "business@coniv.in",
  contact: "contact@coniv.in",
  info: "info@coniv.in",
  marketing: "marketing@coniv.in"
};

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  userSignupOtp: {
    subject: "Your Verification Code for {APP_NAME}",
    body: `<p>Hi there,</p><p>Thank you for signing up for {APP_NAME}. Please use the following one-time password (OTP) to complete your registration:</p><div class="otp">{OTP}</div><p>This code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.</p><p>Best regards,<br/>The {APP_NAME} Team</p>`
  },
  passwordResetOtp: {
    subject: "Your Password Reset Code for {APP_NAME}",
    body: `<p>Hi there,</p><p>We received a request to reset your password. Use the following one-time password (OTP) to proceed:</p><div class="otp">{OTP}</div><p>This code will expire in 10 minutes.</p><p>If you did not request a password reset, please ignore this email.</p><p>Best regards,<br/>The {APP_NAME} Team</p>`
  },
  purchaseConfirmation: {
    subject: "Your Resource Point Purchase Confirmation from {APP_NAME}",
    body: `<p>Hi {USER_NAME},</p><p>Thank you for your purchase. Your account has been credited with resource points.</p><div class="section"><div class="section-title">Purchase Details</div><p><strong>Package:</strong> {PACKAGE_NAME}</p><p><strong>Points Added:</strong> {POINTS_AWARDED}</p><p><strong>Amount Paid:</strong> {AMOUNT_PAID}</p><p><strong>New Balance:</strong> {NEW_BALANCE}</p><p><strong>Transaction ID:</strong> {TRANSACTION_ID}</p></div><p>You can view your full payment history in the 'Coins & Payments' section of your dashboard.</p><br/><p>Thank you for your support,<br/>The {APP_NAME} Team</p>`
  },
  userAlert: {
    subject: "[{APP_NAME}] Important Alert: {ALERT_TITLE}",
    body: `<p>Hi {USER_NAME},</p><p>This is an important alert regarding your {APP_NAME} account:</p><div class="alert"><p class="alert-title">{ALERT_TITLE}</p><p>{ALERT_DESCRIPTION}</p></div><p>Please log in to your account to review this alert and take any necessary actions.</p><br/><p>Thank you,<br/>The {APP_NAME} Security Team</p>`
  },
  generalBusiness: {
    subject: "Welcome to {APP_NAME}!",
    body: `<p>Hi {USER_NAME},</p><p>Welcome aboard! We're thrilled to have you join the community of forward-thinking contractors using {APP_NAME} to streamline their business.</p><p>To get started, we recommend exploring the <strong>Workflow Guide</strong> in the app to understand the core features. Here are a few first steps you can take:</p><ol><li>Set up your Company Profile under 'Resource Management'.</li><li>Add a Client in the 'Organizations' section.</li><li>Create your first Estimate.</li></ol><p>Our goal is to empower you to manage your projects with ease and efficiency. If you have any questions, don't hesitate to reach out via the 'Help & Support' section in the app.</p><br/><p>Happy building,<br/>The {APP_NAME} Team</p>`
  },
  supportResponse: {
    subject: "Re: Your Support Ticket #{TICKET_ID}",
    body: `<p>Hi {USER_NAME},</p><p>This is a response to your recent support request (Ticket #{TICKET_ID}).</p><hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/><p><strong>Our Team's Response:</strong></p><div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">{SUPPORT_RESPONSE}</div><hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/><p>If you have any further questions, please reply directly to this email.</p><br/><p>Best regards,<br/>The {APP_NAME} Support Team</p>`
  },
  weeklyTopAlerts: {
    subject: "Your Weekly Top Alerts from {APP_NAME}",
    body: `<p>Hi {USER_NAME},</p><p>Here are your top alerts for this week. Taking action on these items can help keep your business running smoothly.</p><div class="section"><div class="section-title">Top Alerts</div>{TOP_ALERTS_HTML}</div><p>Log in to your dashboard to view all alerts and take action.</p>`
  },
  weeklyInvoiceFollowups: {
    subject: "Weekly Overdue Invoice Summary from {APP_NAME}",
    body: `<p>Hi {USER_NAME},</p><p>This is your weekly summary of unpaid and overdue invoices. Following up on these can improve your cash flow.</p><div class="section"><div class="section-title">Overdue/Unpaid Invoices</div>{OVERDUE_INVOICES_HTML}</div><p>Log in to view details and send reminders.</p>`
  },
  weeklySecurityDepositFollowups: {
    subject: "Weekly Security Deposit Reminders from {APP_NAME}",
    body: `<p>Hi {USER_NAME},</p><p>Here are the security deposits from completed projects that are due for return soon:</p><div class="section"><div class="section-title">Upcoming SD Returns</div>{SD_RETURNS_HTML}</div><p>Ensure these are processed on time to maintain good client relationships.</p>`
  },
  weeklyFinancialSummary: {
    subject: "Your Weekly Financial Summary from {APP_NAME}",
    body: `<p>Hi {USER_NAME},</p><p>Here's a quick look at your financial performance for the past week:</p><div class="section"><div class="section-title">Summary</div>{FINANCIAL_SUMMARY_HTML}</div><p>For a detailed breakdown, please visit the Advanced Reporting section in your dashboard.</p>`
  },
  weeklyLicensesDue: {
    subject: "Weekly License Renewal Reminder from {APP_NAME}",
    body: `<p>Hi {USER_NAME},</p><p>The following licenses are expiring soon. Please take action to renew them to ensure compliance.</p><div class="section"><div class="section-title">Licenses Expiring Soon</div>{LICENSES_HTML}</div><p>Log in to update license details.</p>`
  },
};

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  youtube: "https://youtube.com",
  linkedin: "https://linkedin.com",
  instagram: "https://instagram.com",
  facebook: "https://facebook.com",
  twitter: "https://x.com"
};

export const DEFAULT_TERMS_AND_CONDITIONS = `
# Terms and Conditions
**Last Updated:** October 10, 2025

Welcome to CONIV ("the App", "we", "us", "our"). These Terms and Conditions ("Terms") govern your use of our application and services. By creating an account and using the App, you agree to be bound by these Terms.

## Acceptance of Terms
By accessing, browsing, or using the App, you acknowledge that you have read, understood, and agree to be legally bound by these Terms and our Privacy Policy. If you do not agree to any of these terms, you are prohibited from using or accessing this site.

## Service Description
CONIV provides a comprehensive suite of tools for contractors and businesses to manage projects, including but not limited to estimates, work orders, invoices, labour and inventory management, and AI-powered business analytics.

## User Accounts & Responsibilities
- **Account Security:** You are responsible for safeguarding your account password and any other credentials used to access the App, including your 4-digit PIN. You agree not to disclose your password or PIN to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
- **User Conduct:** You agree not to use the App for any unlawful purpose or to engage in any activity that is fraudulent, malicious, or violates the rights of others. You are solely responsible for all data, information, and content that you upload, transmit, or process via the App.

## Resource Points & Payments
- **Usage Cost:** Certain features within the App consume "Resource Points". The cost for each feature is displayed within the App and is subject to change.
- **Acquisition:** Resource Points can be acquired through promotional rewards (like daily check-ins) or by purchasing packages through our designated payment gateway.
- **Non-Refundable:** All purchases of Resource Points are final and strictly non-refundable. Once purchased or awarded, Resource Points cannot be redeemed for cash, transferred between accounts, or refunded for any reason, including account termination.
- **Payment Processing:** We utilize a third-party payment processor (Razorpay) for all transactions. We are not responsible for any errors, security breaches, or issues arising from the payment gateway.
- **Price Changes:** We reserve the right to change the prices for Resource Points and the costs associated with features at any time.

## AI-Powered Features & Disclaimers
The App includes features powered by artificial intelligence ("AI Features"). These tools provide suggestions, analysis, and generated content based on the data you provide.
- **No Professional Advice:** The output from AI Features is for informational purposes only and is not a substitute for professional, legal, financial, or engineering advice. You must independently verify all AI-generated content before relying on it.
- **Limitation of Liability for AI:** You are solely responsible for your use of any AI-generated content. We are not liable for any inaccuracies, errors, omissions, or for any decisions, losses, or damages of any kind resulting from your use of these features.

## Intellectual Property & License
- **Our IP:** We own all rights, title, and interest in and to the App, its software, and its content (excluding your data), including all associated intellectual property rights.
- **Your License:** We grant you a limited, non-exclusive, non-transferable, revocable license to use the App in accordance with these Terms.
- **Restrictions on Use:** You may not copy, modify, distribute, sell, or lease any part of our services or included software. You may not reverse engineer or attempt to extract the source code of the App.
- **Prohibition on Repackaging:** You are expressly prohibited from repackaging, "framing", wrapping, or redistributing the App in any form, including but not limited to creating mobile or desktop applications that load our website in a WebView or similar container, without our express written permission. Violation of this clause will result in immediate account termination and potential legal action.
- **Your Content:** You retain all ownership rights to the business data and content you upload. By using the App, you grant us a license to use this data solely for providing and improving the service for you.

## Account Termination
We may terminate or suspend your account and bar access to the App immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the App will immediately cease. All provisions of the Terms which by their nature should survive termination shall survive, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.

## Cancellations and Refunds
As stated under the "Resource Points & Payments" section, all purchases of Resource Points are final and non-refundable. There are no cancellations or refunds for partially used or unused Resource Points packages. If you terminate your account, any remaining Resource Points are forfeited and cannot be redeemed for any monetary value.

## Shipping Policy
CONIV is a digital software-as-a-service (SaaS) application. As such, there are no physical goods to be shipped. All services and features are delivered electronically through the web application, mobile application, or desktop application.

## Governing Law and Jurisdiction
These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. You agree to submit to the exclusive jurisdiction of the courts located in Jaipur, Rajasthan, India to resolve any legal matter arising from these Terms.

## Changes to Terms
We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide at least 30 days' notice before any new terms take effect. Your continued use of the App after such changes constitutes your acceptance of the new Terms.

## Contact Us
If you have any questions about these Terms, please contact us at contact@coniv.in.
`;

export const DEFAULT_PRIVACY_POLICY = `
# Privacy Policy for CONIV
**Last Updated:** October 10, 2025

This Privacy Policy describes how CONIV ("we", "us", "our") collects, uses, and shares your personal information when you use our application, in compliance with India's Digital Personal Data Protection Act, 2023 (DPDPA).

## Information We Collect

### a. Information You Provide
- **Account Information:** To create an account, we require your name, email, and password. You may optionally provide a phone number.
- **Profile Information:** You can enhance your profile with details like your address, profile picture, and an e-signature image for document signing.
- **Business Data:** As part of using the service, you will upload and manage business-related data, including company profiles, client details, project information, financial records (estimates, invoices, expenses), and information about your labour force and subcontractors.

### b. Information We Collect Automatically
- **Usage Data:** We may collect information about your interaction with our App, such as features used, time spent on pages, and buttons clicked. This helps us improve our service. You can manage consent for this in your account settings.
- **Device & Log Information:** For security and troubleshooting, we collect information like your IP address, browser type, operating system, and access times.

## How We Use Your Information (Purpose of Processing)
Your data is processed for the following purposes, based on your consent and for the performance of our service:
- **To Provide and Maintain the Service:** To operate the App, authenticate you, secure your account, and provide customer support.
- **To Process Transactions:** To manage your purchases of Resource Points and deduct points when you use features.
- **To Power AI Features:** To provide you with AI-driven analysis and content generation. Your data is sent to our AI service provider (Google's Gemini) for processing under their strict data protection terms. Your business data is not used to train their public models.
- **To Communicate with You:** To send essential service notifications, security alerts, and support messages.
- **To Improve Our Services:** To analyze usage patterns and improve the App's functionality and user experience.

## Data Sharing and Disclosure
We are committed to not selling your personal data. We only share your information under these limited circumstances:
- **With Service Providers:** We use third-party companies for services like payment processing (Razorpay), cloud hosting (Google Cloud), and AI processing (Google). These providers are contractually bound to protect your data and only use it for the services they provide to us.
- **For Legal Compliance:** We may disclose your information if required by Indian law or in response to a valid legal request from law enforcement or government authorities.

## Your Rights Under the DPDPA, 2023
As a Data Principal, you have the following rights:
- **Right to Access:** You have the right to a summary of your personal data being processed. You can use the "Data Export" feature in your settings for a copy of your data.
- **Right to Correction and Erasure:** You can update your profile information directly in the App. For other corrections or to request the erasure of your data, please contact our Grievance Officer.
- **Right of Grievance Redressal:** You have the right to an easily accessible way to register a grievance with us. Please see the "Contact Us" section below.
- **Right to Nominate:** You have the right to nominate another individual to exercise your rights under the DPDPA in the event of your death or incapacity.

## Data Retention
We retain your personal data for as long as your account is active. If you request account deletion, we will delete your data in accordance with our data deletion process, except for information we are legally required to retain for a longer period (e.g., for tax or financial auditing purposes).

## Contact Us (Grievance Officer)
For any questions, concerns, or grievances regarding your personal data or this Privacy Policy, please contact our Grievance Officer:
- **Email:** contact@coniv.in

## Updates to this Policy
We may update this Privacy Policy from time to time which can be accessed at the privacy section.
`;

// Individual cost constants
export const DEFAULT_SIGNUP_RESOURCE_POINTS = 1000;
export const COMPANY_CREATION_COST = 10;
export const BANK_ACCOUNT_CREATION_COST = 5;
export const ORGANIZATION_CREATION_COST = 5;
export const FOLLOW_UP_CREATION_COST = 2;
export const ESTIMATE_CREATION_COST = 8;
export const WORK_ORDER_CREATION_COST = 10;
export const INVOICE_CREATION_COST = 8;
export const LABOUR_ENTRY_CREATION_COST = 2;
export const DOCUMENT_LINKING_COST = 2;
export const PURCHASE_ORDER_CREATION_COST = 5;
export const PO_COMMIT_TO_EXPENSE_COST = 2;
export const INVENTORY_ITEM_CREATION_COST = 2;
export const INVENTORY_TRANSACTION_COST = 1;
export const LICENSE_CREATION_COST = 5;
export const SOR_RATE_CREATION_COST = 1;
export const EXPENSE_RECORDING_COST = 2;
export const LABOUR_PAYMENT_RECORDING_COST = 2;
export const DIGITAL_BUSINESS_CARD_CREATION_COST = 10;
export const MARKETPLACE_LISTING_CREATION_COST = 5;
export const TEAM_INVITATION_COST = 10;
export const TIME_TRACKING_LOG_COST = 1;
export const DPR_CREATION_COST = 5;
export const SERVICE_VISIT_REPORT_CREATION_COST = 5;
export const AI_ESTIMATE_SUGGESTION_COST = 5;
export const AI_DOCUMENT_ANALYSIS_COST = 5;
export const AI_RISK_ASSESSMENT_COST = 20;
export const AI_AUDIT_TOOL_BASE_COST = 50;
export const LETTER_CERTIFICATE_GENERATION_COST = 10;
export const AI_PORTFOLIO_GENERATION_COST = 80;
export const WEEKLY_EMAIL_DIGEST_COST = 3;
export const PIN_SETUP_COST = 0;
export const TWO_FA_ENABLE_COST = 0;
export const TASK_CREATION_COST = 5;
export const CHAT_MESSAGE_COST = 0.2;
export const SUBCONTRACTOR_CREATION_COST = 5;
export const AI_WO_ANALYSIS_COST = 35;
export const AI_FINANCIAL_HEALTH_COST = 40;
export const AI_LABOR_ANALYSIS_COST = 30;
export const AI_BID_ADVISOR_COST = 40;
export const AI_SAFETY_COMPLIANCE_COST = 25;
export const AI_PROJECT_SCHEDULER_COST = 50;
export const AI_CASH_FLOW_FORECASTER_COST = 45;
export const AI_SMART_COLLECTIONS_COST = 15;
export const AI_FRAUD_DETECTOR_COST = 50;
export const AI_EXPENSE_ANOMALY_COST = 45;
export const AI_MATERIALS_FORECASTER_COST = 40;
export const AI_TEAM_PERFORMANCE_COST = 50;
export const AI_AUDIT_TOOL_Q_AND_A_COST = 35;
export const AI_DAILY_BRIEFING_COST = 10;
export const AI_MARKETING_CONTENT_GENERATION_COST = 30;
export const PORTFOLIO_CONTACT_REQUEST_COST = 3;
export const MAILING_LIST_ADDITION_COST = 1;
export const MAILING_LIST_MEMBERSHIP_COST = 0.5;
export const MAILING_LIST_EMAIL_SEND_COST = 2;

// ────────────────────────────────────────────────
// Auth Schemas
export const SendPasswordResetOtpInputSchema = z.object({
  email: z.string().email(),
});

export const SendPasswordResetOtpOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const VerifyPasswordResetOtpInputSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
});

export const VerifyPasswordResetOtpOutputSchema = z.object({
  success: z.boolean(),
  token: z.string().optional(),
  error: z.string().optional(),
});

export const ResetPasswordWithTokenInputSchema = z.object({
  email: z.string().email(),
  token: z.string().uuid(),
  newPassword: z.string().min(6),
});

export const ResetPasswordWithTokenOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type WorkOrderProfitLoss = z.infer<typeof WorkOrderProfitLossSchema>;
export const WorkOrderProfitLossSchema = z.object({
  workOrderId: z.string(),
  workOrderNumber: z.string(),
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  profitLoss: z.number(),
});

// ────────────────────────────────────────────────
// AI & Flow Schemas (complete set)
export const SuggestEstimateItemsInputSchema = z.object({
  userId: z.string(),
  projectScope: z.string().min(10, 'Please provide a more detailed project scope.'),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});

export type SuggestEstimateItemsInput = z.infer<typeof SuggestEstimateItemsInputSchema>;

export const AISuggestedEstimateItemSchema = z.object({
  description: z.string(),
  unit: z.string(),
});

export type AISuggestedEstimateItem = z.infer<typeof AISuggestedEstimateItemSchema>;

export const AIEstimateSuggestionOutputSchema = z.object({
  subjectOfWork: z.string(),
  suggestedItems: z.array(AISuggestedEstimateItemSchema),
  newResourcePoints: z.number().optional(),
});

export type SuggestEstimateItemsOutput = z.infer<typeof AIEstimateSuggestionOutputSchema>;

export const GenerateScheduleInputSchema = z.object({
  workOrderId: z.string(),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});

export type GenerateScheduleInput = z.infer<typeof GenerateScheduleInputSchema>;

const TaskOutputSchema = z.object({
  taskName: z.string().describe("A concise, descriptive name for the task."),
  durationInDays: z.number().int().min(1).describe("The estimated duration of the task in calendar days."),
});

export const AIModelOutputSchemaForSchedule = z.object({
  tasks: z.array(TaskOutputSchema).describe("A list of tasks needed to complete the project, in a logical sequence."),
});

export type Task = {
  id?: string;
  userId: string;
  workOrderId: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  dependencies?: string | null;
  createdAt: string;
  updatedAt: string;
};
export const GenerateScheduleOutputSchema = z.object({
  tasksCreated: z.number(),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type GenerateScheduleOutput = z.infer<typeof GenerateScheduleOutputSchema>;

export const AuditContractorActivitiesInputSchema = z.object({
  companyId: z.string().describe("The ID of the company to audit."),
  industryBenchmarks: z.string().describe('Industry benchmarks for similar contractor companies, including average revenue, expenses, and profit margins.'),
  economicData: z.string().describe('Relevant economic data, such as inflation rates, labor costs, and material prices.'),
  workOrderStatusFilter: z.string().optional().describe("Optional filter for work order status (e.g., 'completed', 'in-progress')."),
  invoiceStatusFilter: z.string().optional().describe("Optional filter for invoice status (e.g., 'paid', 'overdue')."),
  estimateStatusFilter: z.string().optional().describe("Optional filter for estimate status (e.g., 'approved', 'submitted')."),
  sdFilter: z.enum(['all', 'with_sd', 'without_sd']).optional().describe("Filter for work orders based on security deposit: 'all', 'with_sd', 'without_sd'."),
  licenseFilter: z.enum(['all', 'expiring_soon']).optional().describe("Filter for licenses: 'all', 'expiring_soon' (within next 90 days)."),
  userId: z.string().describe("The ID of the user (data owner) performing the audit for point deduction."),
  actorUid: z.string().optional().describe("The UID of the user performing the action (for logging). If not provided, userId is used."),
  actorName: z.string().optional().describe("The name of the user performing the action (for logging)."),
});

export type AuditContractorActivitiesInput = z.infer<typeof AuditContractorActivitiesInputSchema>;

export const AuditAIModelOutputSchema = z.object({
  auditSummary: z.string().describe('A summary of the audit findings, including potential errors, inconsistencies, and areas for improvement based on the provided data.'),
  suggestedCorrections: z.string().describe('Specific suggestions for correcting errors and optimizing business practices, based on the provided data, industry benchmarks, and economic data.'),
  riskAssessment: z.string().describe('An assessment of the risks associated with the identified errors and inconsistencies, including potential financial and legal consequences based on the provided data.'),
});

export type AuditAIModelOutput = z.infer<typeof AuditAIModelOutputSchema>;

export const AuditContractorActivitiesOutputSchema = AuditAIModelOutputSchema.extend({
  newResourcePoints: z.number().optional().describe("The new resource point balance if deduction was successful."),
  error: z.string().optional(),
});

export type AuditContractorActivitiesOutput = z.infer<typeof AuditContractorActivitiesOutputSchema>;

export const RiskAssessmentAIModelOutputSchema = z.object({
  auditSummary: z.string().describe("A summary of the identified risks."),
  potentialIssues: z.array(z.string()).optional().describe("A list of specific potential issues."),
  mitigationSuggestions: z.array(z.string()).optional().describe("A list of suggestions to mitigate risks."),
});

export type RiskAssessmentAIModelOutput = z.infer<typeof RiskAssessmentAIModelOutputSchema>;

export const AssessDocumentRiskInputSchema = z.object({
  documentId: z.string(),
  documentType: z.enum(['estimate', 'workOrder']),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});

export type AssessDocumentRiskInput = z.infer<typeof AssessDocumentRiskInputSchema>;

export const AssessDocumentRiskOutputSchema = RiskAssessmentAIModelOutputSchema.extend({
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type AssessDocumentRiskOutput = z.infer<typeof AssessDocumentRiskOutputSchema>;

export const LaborAnalysisOutputSchema = z.object({
  auditSummary: z.string().describe('A summary of the labor data analysis, noting total costs, number of laborers, and overall efficiency.'),
  suggestedCorrections: z.string().describe('Specific suggestions for improving labor efficiency, cost management, or data logging practices.'),
  riskAssessment: z.string().describe('An assessment of potential risks, such as cost overruns, compliance issues from missing data, or productivity concerns.'),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type LaborAnalysisOutput = z.infer<typeof LaborAnalysisOutputSchema>;

export const WOAnalysisOutputSchema = z.object({
  auditSummary: z.string().describe("A summary of the work order analysis, noting overall status, financial health, and progress."),
  suggestedCorrections: z.string().describe("Specific suggestions for improving the work order's execution, cost management, or documentation."),
  riskAssessment: z.string().describe("An assessment of potential risks, such as schedule delays, cost overruns, or incomplete documentation."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type WOAnalysisOutput = z.infer<typeof WOAnalysisOutputSchema>;

export const BidAdvisorOutputSchema = z.object({
  recommendationScore: z.number().min(0).max(100).describe("A score from 0 to 100 indicating the match/advisability of bidding."),
  recommendation: z.enum(['Strongly Recommend', 'Recommend', 'Neutral', 'Caution Advised', 'Do Not Recommend']).describe("A clear recommendation category."),
  reasoning: z.string().describe("A detailed explanation for the recommendation, citing specific data points from the company's profile and project history vs. the tender requirements."),
  pros: z.array(z.string()).describe("A list of strengths or reasons FOR bidding."),
  cons: z.array(z.string()).describe("A list of weaknesses, risks, or reasons AGAINST bidding."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type BidAdvisorOutput = z.infer<typeof BidAdvisorOutputSchema>;

export const CashFlowOutputSchema = z.object({
  forecastSummary: z.string().describe("A high-level summary of the cash flow situation, noting potential surpluses or shortfalls."),
  thirtyDayForecast: z.object({
    inflows: z.number(),
    outflows: z.number(),
    netFlow: z.number(),
    analysis: z.string(),
  }).describe("Detailed 30-day forecast with analysis."),
  sixtyDayForecast: z.object({
    inflows: z.number(),
    outflows: z.number(),
    netFlow: z.number(),
    analysis: z.string(),
  }).describe("Detailed 60-day forecast with analysis."),
  ninetyDayForecast: z.object({
    inflows: z.number(),
    outflows: z.number(),
    netFlow: z.number(),
    analysis: z.string(),
  }).describe("Detailed 90-day forecast with analysis."),
  actionableInsights: z.array(z.string()).describe("A list of specific, actionable recommendations to improve cash flow."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type CashFlowOutput = z.infer<typeof CashFlowOutputSchema>;

export const BriefingOutputSchema = z.object({
  greeting: z.string().describe("A friendly and professional greeting for the user."),
  priorityTasks: z.array(z.string()).describe("A list of the most urgent tasks for the day."),
  summary: z.string().describe("A concise paragraph summarizing the key items for the day."),
  newResourcePoints: z.number().optional(),
});

export type BriefingOutput = z.infer<typeof BriefingOutputSchema>;

export const SuspiciousActivitySchema = z.object({
  description: z.string().describe("A clear and concise description of the suspicious activity."),
  reason: z.string().describe("The specific reason why this activity is flagged as suspicious."),
  activityLogId: z.string().optional().describe("The ID of the related activity log entry, if applicable."),
});

export type SuspiciousActivity = z.infer<typeof SuspiciousActivitySchema>;

export const FraudAnalysisOutputSchema = z.object({
  analysisSummary: z.string().describe("A brief, high-level summary of the findings."),
  riskScore: z.number().min(0).max(100).describe("An overall risk score from 0 (no risk) to 100 (high risk)."),
  suspiciousActivities: z.array(SuspiciousActivitySchema).describe("A list of activities flagged as potentially fraudulent or suspicious."),
  recommendations: z.string().describe("Actionable recommendations for the account owner, such as 'Review user permissions' or 'Verify recent large deletions'."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type FraudAnalysisOutput = z.infer<typeof FraudAnalysisOutputSchema>;

export const AnomalySchema = z.object({
  expenseId: z.string(),
  description: z.string().describe("A clear and concise description of the anomalous expense."),
  reason: z.string().describe("The specific reason why this expense is flagged as an anomaly (e.g., 'Significantly higher than average for category', 'Unusual expense category for this project type')."),
  amount: z.coerce.number().describe("The amount of the expense."),
  category: z.string().describe("The category of the expense."),
});

export const AnomalyOutputSchema = z.object({
  analysisSummary: z.string().describe("A brief, high-level summary of the findings."),
  riskScore: z.number().min(0).max(100).describe("An overall risk score from 0 (no risk of anomalies)."),
  anomalies: z.array(AnomalySchema).describe("A list of expenses flagged as potentially anomalous."),
  recommendations: z.string().describe("Actionable recommendations for the account owner, such as 'Review all fuel expenses for Project X' or 'Verify the vendor for the high-value 'Other' expense'."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type AnomalyOutput = z.infer<typeof AnomalyOutputSchema>;

export const PerformanceOutputSchema = z.object({
  efficiencySummary: z.string().describe("A summary of overall team efficiency, noting peak activity times and common actions."),
  topPerformers: z.array(z.object({ name: z.string(), activityCount: z.number(), contribution: z.string() })).describe("A list of top-performing members based on activity volume and significance of their actions."),
  bottleneckAnalysis: z.string().describe("An analysis of potential bottlenecks, such as long delays between related tasks (e.g., Estimate approval and Work Order creation)."),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type TeamPerformanceOutput = z.infer<typeof PerformanceOutputSchema>;

export const FollowUpDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;

export const SmartCollectionsOutputSchema = z.object({
  draft: FollowUpDraftSchema,
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type SmartCollectionsOutput = z.infer<typeof SmartCollectionsOutputSchema>;

export const HealthCheckOutputSchema = z.object({
  auditSummary: z.string(),
  suggestedCorrections: z.string(),
  riskAssessment: z.string(),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type HealthCheckOutput = z.infer<typeof HealthCheckOutputSchema>;

export const SafetyComplianceOutputSchema = z.object({
  overallRiskScore: z.number().min(0).max(100),
  overallAssessment: z.string(),
  potentialRisks: z.array(z.object({
    description: z.string(),
    sourceDocument: z.string(),
    date: z.string(),
  })),
  recommendations: z.array(z.string()),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});

export type SafetyComplianceOutput = z.infer<typeof SafetyComplianceOutputSchema>;

// ────────────────────────────────────────────────
// Document Generation Schemas
export const DocumentGenerationInputSchema = z.object({
  userId: z.string(),
  documentType: z.enum(['Letter', 'Certificate']),
  recipient: z.string().describe("The recipient of the document. e.g., 'The Branch Manager, SBI' or 'Mr. John Doe'"),
  subject: z.string().describe("The subject line or main title of the document."),
  context: z.string().describe("The main body, purpose, and key details to be included in the document."),
  customFields: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).optional().describe("Optional key-value pairs for specific data points like 'Project Name', 'Date of Completion', etc."),
});

export type DocumentGenerationInput = z.infer<typeof DocumentGenerationInputSchema>;

export const DocumentGenerationOutputSchema = z.object({
  title: z.string().describe("The generated title for the document."),
  content: z.string().describe("The full generated content of the document in markdown format."),
  newResourcePoints: z.number().optional(),
});

export type DocumentGenerationOutput = z.infer<typeof DocumentGenerationOutputSchema>;




export const ExtractDocumentInfoInputSchema = z.object({
  imageDataUri: z.string(),
  userId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
export type ExtractDocumentInfoInput = z.infer<typeof ExtractDocumentInfoInputSchema>;

export const ExtractDocumentInfoOutputSchema = z.object({
extractedText: z.string(),
detectedType: z.string().optional(),
keyValues: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
analysis: z.string().optional(),
newResourcePoints: z.number().optional(),
error: z.string().optional(),
});
export type ExtractDocumentInfoOutput = z.infer<typeof ExtractDocumentInfoOutputSchema>;

// ────────────────────────────────────────────────
// Entity Interfaces (complete)
export interface UserNotificationPreferences {
  importantUpdates: boolean;
  newMessages: boolean;
  invoicePaid: boolean;
  workOrderStatusAlerts: boolean;
  weeklyInvoiceFollowups: boolean;
  weeklySecurityDepositFollowups: boolean;
  weeklyFinancialSummary: boolean;
  weeklyLicensesDue: boolean;
  weeklyTopAlerts: boolean;
  marketplaceUpdates: boolean;
  newLoginAlerts: boolean;
  largeExpenseAlerts: boolean;
  projectBudgetWatch: boolean;
  profitabilityDipAlerts: boolean;
  lastWeeklyDigestSent: string;
  preferredDigestDay?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  fullName: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  profilePicture?: string | null;
  eSignature?: string | null;
  signaturePhrase1?: string | null;
  signaturePhrase2?: string | null;
  isAdmin?: boolean;
  dateCreated?: string;
  lastLogin?: string;
  updatedAt?: string;
  ownerId?: string | null;
  teamMemberId?: string | null;
  resourcePoints?: number;
  resourcePointsLastUpdated?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  notificationPreferences?: UserNotificationPreferences | null;
  is2FAEnabled?: boolean;
  isPinEnabled?: boolean;
  appPin?: string | null;
  lastCheckInDate?: string;
  claimedBannerRewards?: string[];
  passwordChangeDays?: number | null;
  lastPasswordChangeDate?: string | null;
  pinChangeDays?: number | null;
  lastPinChangeDate?: string | null;
  logActiveTime?: boolean;
  lastWeeklyDigestSent?: string | null;
}

export interface Company {
  id?: string;
  userId: string;
  createdByName?: string;
  name: string;
  companyType?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  gstin?: string | null;
  panNumber?: string | null;
  registrationNumber?: string | null;
  establishedYear?: number | null;
  address: string;
  website?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  role?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface BankAccount {
  id?: string;
  userId: string;
  createdByName?: string;
  companyId?: string | null;
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountType: 'current' | 'savings' | 'other';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export const ORGANIZATION_TYPES_OPTIONS = ['Government', 'Non-Profit', 'Educational', 'Corporate', 'Small Business', 'Public Sector Unit (PSU)', 'Healthcare', 'Real Estate', 'Consulting', 'Individual', 'Other'] as const;
export const LEAD_SOURCE_OPTIONS = ['Referral', 'Website', 'Advertisement', 'Cold Call', 'Event', 'Social Media', 'Existing Client', 'Other'] as const;
export const ORGANIZATION_STATUS_OPTIONS = ['Lead', 'Prospect', 'Contacted', 'Proposal Sent', 'Negotiation', 'Active Client', 'On Hold', 'Past Client', 'Lost'] as const;
export const PREFERRED_CONTACT_METHOD_OPTIONS = ['email', 'phone', 'meeting'] as const;

export type OrganizationType = typeof ORGANIZATION_TYPES_OPTIONS[number];
export type LeadSourceType = typeof LEAD_SOURCE_OPTIONS[number];
export type OrganizationStatusType = typeof ORGANIZATION_STATUS_OPTIONS[number];
export type PreferredContactMethodType = typeof PREFERRED_CONTACT_METHOD_OPTIONS[number];

export interface Organization {
  id?: string;
  userId: string;
  createdByName?: string;
  name: string;
  type?: OrganizationType | string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
  organizationStatus?: OrganizationStatusType | null;
  leadSource?: LeadSourceType | null;
  nextFollowUpDate?: string | null;
}

export const FOLLOW_UP_STATUS_OPTIONS = ['pending', 'completed', 'cancelled'] as const;
export type FollowUpStatus = typeof FOLLOW_UP_STATUS_OPTIONS[number];

export interface FollowUp {
  id?: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  visitDate: string;
  contactPerson?: string | null;
  notes: string;
  reminderDate: string;
  status: FollowUpStatus;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface EstimateItem {
  id?: string;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export type EstimateStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired';
export const ESTIMATE_STATUS_OPTIONS: EstimateStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'expired'];

export interface Estimate {
  id?: string;
  userId: string;
  createdByName?: string;
  estimateNumber: string;
  subjectOfWork?: string | null;
  date: string;
  validUntil?: string | null;
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  companyGstin?: string | null;
  companyLogoUrl?: string | null;
  companyContactPerson?: string | null;
  companyContactEmail?: string | null;
  companyContactPhone?: string | null;
  organizationId: string;
  organizationName: string;
  organizationAddress?: string | null;
  organizationGstin?: string | null;
  status: EstimateStatus;
  items: EstimateItem[];
  subTotal: number;
  discount?: number | null;
  taxableValue?: number;
  taxRate?: number;
  taxAmount?: number | null;
  grandTotal: number;
  termsAndConditions?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface WorkOrderItem {
  id?: string;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export type WorkOrderStatus = 'draft' | 'pending' | 'approved' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
export const WORK_ORDER_STATUS_OPTIONS: WorkOrderStatus[] = ['draft', 'pending', 'approved', 'in-progress', 'completed', 'on-hold', 'cancelled'];

export interface WorkOrder {
  id?: string;
  userId: string;
  createdByName?: string;
  workOrderNumber: string;
  organizationId: string;
  organizationName: string;
  organizationAddress?: string | null;
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  startDate: string;
  endDate: string;
  securityDeposit?: number | null;
  depositPeriod?: number | null;
  scopeOfWork?: string | null;
  estimateId?: string | null;
  status: WorkOrderStatus;
  items: WorkOrderItem[];
  subTotal: number;
  discount?: number | null;
  taxableValue?: number;
  taxRate?: number | null;
  taxAmount?: number | null;
  grandTotal: number;
  termsAndConditions?: string | null;
  awardProofUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface InvoiceItem {
  id?: string;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'unpaid' | 'overdue' | 'cancelled' | 'partially-paid';
export const INVOICE_STATUS_OPTIONS: InvoiceStatus[] = ['draft', 'sent', 'paid', 'unpaid', 'overdue', 'cancelled', 'partially-paid'];

export interface OtherDeduction {
  description: string;
  amount: number;
}

export interface Invoice {
  id?: string;
  userId: string;
  createdByName?: string;
  invoiceNumber: string;
  workOrderId?: string | null;
  workOrderNumber?: string | null;
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  companyGstin?: string | null;
  companyLogoUrl?: string | null;
  companyContactPerson?: string | null;
  companyContactEmail?: string | null;
  companyContactPhone?: string | null;
  organizationId: string;
  organizationName: string;
  organizationAddress?: string | null;
  organizationGstin?: string | null;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subTotal: number;
  discount?: number | null;
  taxRate?: number;
  taxAmount?: number | null;
  grandTotal: number;
  amountPaid?: number | null;
  balanceDue: number;
  paymentInstructions?: string | null;
  notes?: string | null;
  paymentProofUrl?: string | null;
  sdDeducted?: number | null;
  tdsDeducted?: number | null;
  ldDeducted?: number | null;
  otherDeductions?: OtherDeduction[] | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
  taxableValue?: number;
}

export interface SorRate {
  id?: string;
  userId: string;
  createdByName?: string;
  itemCode: string;
  itemDescription: string;
  unit: string;
  rate: number;
  visibility: 'public' | 'private';
  organizationId?: string | null;
  organizationName?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface LabourRegister {
  id?: string;
  userId: string;
  createdByName?: string;
  companyId: string;
  companyName: string;
  organizationId: string;
  organizationName: string;
  workOrderId: string;
  workOrderNumber: string;
  workerName: string;
  role: string;
  dailyWage: number;
  medicalCertificateUrl?: string | null;
  medicalCertificateNumber?: string | null;
  medicalCertificateExpiry?: string | null;
  nocUrl?: string | null;
  nocNumber?: string | null;
  nocExpiry?: string | null;
  identityProofUrl?: string | null;
  identityProofNumber?: string | null;
  gatePassUrl?: string | null;
  gatePassNumber?: string | null;
  gatePassExpiry?: string | null;
  totalDaysWorked: number;
  totalAmount: number;
  advancesPaid: number;
  netAmount: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface LabourAttendance {
  id?: string;
  userId: string;
  createdByName?: string;
  labourRegisterId: string;
  workOrderId: string;
  date: string;
  present: boolean;
  hoursWorked?: number | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface LabourAdvance {
  id?: string;
  userId: string;
  createdByName?: string;
  labourRegisterId: string;
  labourerName: string;
  workOrderId: string;
  workOrderNumber: string;
  date: string;
  amount: number;
  description?: string | null;
  documentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface LabourTimeLog {
  id?: string;
  userId: string;
  createdByName?: string;
  labourRegisterId: string;
  workOrderId: string;
  workOrderNumber?: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  hoursWorked?: number | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export const DOCUMENT_TYPES_OPTIONS = ['Inward', 'Outward', 'Returnable', 'Permit', 'Measurement Sheet', 'Item Bills', 'Daily Progress Report', 'Other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES_OPTIONS)[number];

export interface Document {
  id?: string;
  userId: string;
  createdByName?: string;
  workOrderId?: string | null;
  workOrderNumber?: string | null;
  subcontractorId?: string | null;
  subcontractorName?: string | null;
  documentName: string;
  documentType: DocumentType | string;
  documentUrl?: string | null;
  dateUploaded: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export const LICENSE_TYPES_OPTIONS = [
  'Trade License', 'Labour License', 'Electrical Contractor License', 'GST Registration',
  'PAN Card', 'TAN Registration', 'ESI Registration', 'EPF Registration',
  'Pollution Control Certificate', 'Fire Safety Certificate', 'Shop & Establishment License',
  'Professional Tax Registration', 'Import Export Code (IEC)', 'MSME Registration',
  'ISO Certification', 'Other'
] as const;
export type LicenseType = typeof LICENSE_TYPES_OPTIONS[number];

export interface License {
  id?: string;
  userId: string;
  createdByName?: string;
  companyId?: string | null;
  companyName?: string | null;
  licenseName: string;
  licenseNumber: string;
  licenseType: LicenseType | string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  documentUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export const EXPENSE_CATEGORY_OPTIONS = [
  'Materials', 'Labour', 'Subcontractor', 'Fuel', 'Equipment Rental', 'Site Utilities',
  'Transportation', 'Permits & Fees', 'Office Supplies', 'Marketing', 'Travel',
  'Insurance', 'Repair & Maintenance', 'Bank Charges', 'Taxes', 'Labour Advance/Payment', 'Other'
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORY_OPTIONS[number];

export interface Expense {
  id?: string;
  userId: string;
  createdByName?: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string | null;
  workOrderId?: string | null;
  workOrderNumber?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export const DEFAULT_TEAM_PERMISSIONS = {
  canManageTeam: false,
  canViewEstimates: false,
  canCreateEstimates: false,
  canEditEstimates: false,
  canDeleteEstimates: false,
  canChangeEstimateStatus: false,
  canViewWorkOrders: false,
  canCreateWorkOrders: false,
  canEditWorkOrders: false,
  canDeleteWorkOrders: false,
  canChangeWorkOrderStatus: false,
  canViewInvoices: false,
  canCreateInvoices: false,
  canEditInvoices: false,
  canDeleteInvoices: false,
  canChangeInvoiceStatus: false,
  canManageLabourRegister: false,
  canRecordLabourAttendance: false,
  canManageLabourPayments: false,
  canManageTimeTracking: false,
  canManageDocuments: false,
  canManageCompanies: false,
  canManageBankAccounts: false,
  canManageOwnerLicenses: false,
  canManageOwnerSORs: false,
  canManageOrganizations: false,
  canManageExpenses: false,
  canViewFinancialSummaries: false,
  canRunAudits: false,
  canViewActivityLog: false,
  canCreatePurchaseOrders: false,
  canViewPurchaseOrders: false,
  canEditPurchaseOrders: false,
  canDeletePurchaseOrders: false,
  canChangePurchaseOrderStatus: false,
  canManageInventory: false,
  canManageDigitalBusinessCards: false,
  canManageListings: false,
  canUseAiEstimateGeneration: false,
  canUseAiDocumentAnalysis: false,
  canUseAiRiskAssessment: false,
  canManageDpr: false,
  canManageSvr: false,
  canUseProjectChat: false,
  canManageSubcontractors: false,
  canGenerateLetters: false,
  canUseAiWoAnalysis: false,
  canUseAiFinancialHealthCheck: false,
  canUseAiLaborAnalysis: false,
  canUseAiBidAdvisor: false,
  canUseAiSafetyCompliance: false,
  canUseAiProjectScheduler: false,
  canUseAiCashFlowForecaster: false,
  canUseAiSmartCollections: false,
  canUseAiFraudDetector: false,
  canUseAiExpenseAnomaly: false,
  canUseAiMaterialsForecaster: false,
  canUseAiTeamPerformance: false,
  canUseAiQaAuditor: false,
  canUseAiDailyBriefing: false,
  canViewGanttCharts: false,
  canViewAlerts: false,
  canManageCoinsAndPayments: false,
  canUseAiPortfolioGenerator: false,
  canManageMailingList: false,
};

export type TeamPermissions = typeof DEFAULT_TEAM_PERMISSIONS;

export interface TeamMember {
  id?: string;
  memberUid: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  permissions: TeamPermissions;
  status: 'active' | 'removed' | 'pending_details' | 'removed_by_self' | 'removed_by_owner';
  joinedAt?: string;
  ownerName?: string;
  associatedWorkOrderId?: string | null;
  associatedWorkOrderNumber?: string | null;
  createdAt: string;
  createdByName: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface TeamInvitation {
  id?: string;
  ownerId: string;
  ownerName: string;
  invitedEmail?: string | null;
  invitedPhoneNumber?: string | null;
  invitedMemberName: string;
  permissions: TeamPermissions;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'revoked_by_owner' | 'revoked_member_left';
  createdAt: string;
  updatedAt: string;
  acceptedByUid?: string | null;
  associatedWorkOrderId?: string | null;
  associatedWorkOrderNumber?: string | null;
}

export type SummaryData = Record<string, {
  title: string;
  value: string;
  iconName: string;
  href: string;
  description: string;
  monetaryValue?: string;
  monetaryLabel?: string;
}>;

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  type: 'estimate' | 'workOrder' | 'invoice' | 'license' | 'purchaseOrder' | 'labour' | 'team' | 'inventory' | 'system' | 'organization' | 'financial' | 'follow-up';
  date?: string;
}

export type ActivityLogActionType =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout' | 'active_session_log'
  | 'invite_sent' | 'invite_accepted' | 'invite_declined' | 'invite_cancelled' | 'member_removed' | 'permissions_updated' | 'member_left_team'
  | 'document_upload' | 'payment_recorded' | 'attendance_marked' | 'time_log_saved' | 'dpr_created' | 'svr_created'
  | 'status_changed_estimate' | 'status_changed_work_order' | 'status_changed_invoice' | 'status_changed_purchase_order'
  | 'audit_run' | 'profile_update' | 'preferences_updated' | 'data_export_requested' | 'account_deletion_requested'
  | 'ai_estimate_suggestion' | 'ai_document_analysis' | 'ai_risk_assessment' | 'letter_generation' | 'ai_daily_briefing' | 'ai_branding_generated' | 'ai_marketing_content'
  | 'coin_purchase_success' | 'support_payment_success'
  | 'daily_check_in_reward' | 'banner_reward_claimed'
  | 'auto_email_sent'
  | 'pin_setup' | 'pin_disabled' | 'pin_changed' | 'pin_reset' | '2fa_enabled' | '2fa_disabled'
  | 'portfolio_generated' | 'portfolio_updated' | 'portfolio_contact_request'
  | 'mailing_list_contact_added' | 'mailing_list_campaign_sent'
  | 'FollowUp' | 'Task' | 'MailingList';

export type ActivityLogEntityType =
  | 'Company' | 'BankAccount' | 'Organization' | 'Subcontractor'
  | 'Estimate' | 'WorkOrder' | 'Invoice' | 'PurchaseOrder' | 'DailyProgressReport' | 'ServiceVisitReport'
  | 'LabourRegister' | 'LabourAttendance' | 'LabourAdvance' | 'LabourTimeLog'
  | 'Document' | 'License' | 'SorRate' | 'Expense' | 'InventoryItem' | 'DigitalBusinessCard' | 'ListingItem'
  | 'TeamInvitation' | 'TeamMember' | 'UserProfile' | 'UserSubmission'
  | 'System' | 'Auth' | 'AI'
  | 'PaymentTransaction' | 'MailingListEntry' | 'MailingListContent' | 'MailingListCampaign' | 'Portfolio'
  | 'FollowUp' | 'Task' | 'MailingList' | 'ChatMessage';

export interface ActivityLog {
  id?: string;
  ownerId: string;
  actorUid: string;
  actorName: string;
  actionType: ActivityLogActionType;
  entityType: ActivityLogEntityType;
  entityId?: string | null;
  entityName?: string | null;
  timestamp: string;
  details?: string | Record<string, any>;
}


export const USER_SUBMISSION_TYPE_OPTIONS = ['Query', 'Feedback', 'Bug Report', 'Feature Request'] as const;
export type UserSubmissionType = typeof USER_SUBMISSION_TYPE_OPTIONS[number];

export const USER_SUBMISSION_STATUS_OPTIONS = ['New', 'Open', 'In Progress', 'Resolved', 'Closed', 'Awaiting User Response'] as const;
export type UserSubmissionStatus = typeof USER_SUBMISSION_STATUS_OPTIONS[number];

export interface UserSubmission {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  submissionType: UserSubmissionType;
  subject: string;
  description: string;
  status: UserSubmissionStatus;
  attachmentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  adminReplyMessage?: string | null;
  adminRepliedAt?: string | null;
  adminRepliedByName?: string | null;
  adminNotes?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}
export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'work_order' | 'invoice' | 'estimate' | 'payment' | 'license_expiry' | 'team' | 'general';
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  actorName?: string;
}

export type PurchaseOrderStatus = 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'billed' | 'cancelled';

export interface PurchaseOrderItem {
  id?: string;
  itemCode?: string | null;
  description: string;
  type: 'material' | 'service';
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface PurchaseOrder {
  id?: string;
  userId: string;
  createdByName?: string;
  poNumber: string;
  date: string;
  supplierType: 'organization' | 'subcontractor';
  supplierOrganizationId?: string | null;
  supplierSubcontractorId?: string | null;
  supplierOrganizationName: string;
  companyId: string;
  companyName: string;
  companyAddress?: string;
  company?: Company;
  supplierOrganization?: Organization;
  workOrderId?: string | null;
  workOrderNumber?: string | null;
  items: PurchaseOrderItem[];
  subTotal: number;
  discount?: number | null;
  taxableValue?: number;
  taxRate?: number | null;
  taxAmount?: number | null;
  grandTotal: number;
  shippingAddress?: string | null;
  billingAddress?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  status: PurchaseOrderStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
  linkedExpenseId?: string | null;
  awardProofUrl?: string | null;
}

export type ListingItemType = 'buy' | 'sell' | 'exchange';
export const LISTING_ITEM_TYPE_OPTIONS: readonly [string, ...string[]] = ['buy', 'sell', 'exchange'];

export type ListingItemStatus = 'active' | 'pending_review' | 'sold' | 'exchanged' | 'cancelled' | 'expired';
export const LISTING_ITEM_STATUS_OPTIONS: readonly [string, ...string[]] = ['active', 'pending_review', 'sold', 'exchanged', 'cancelled', 'expired'];

export interface ListingItem {
  id?: string;
  userId: string;
  createdByName?: string;
  title: string;
  description: string;
  itemType: ListingItemType;
  category?: string | null;
  price?: number | null;
  exchangeFor?: string | null;
  imageUrls?: string[] | null;
  logoUrl?: string | null;
  companyId?: string | null;
  status: ListingItemStatus;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  localityOrArea?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
  companyName?: string | null;
}

export interface DigitalBusinessCard {
  id?: string;
  userId: string;
  createdByName?: string;
  companyId?: string | null;
  cardName: string;
  fullName: string;
  title?: string | null;
  companyName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  linkedIn?: string | null;
  twitter?: string | null;
  profilePictureUrl?: string | null;
  logoUrl?: string | null;
  customColor?: string | null;
  notes?: string | null;
  qrCodeDataUrl?: string;
  publicViewId: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface InventoryItem {
  id?: string;
  userId: string;
  createdByName?: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  unitOfMeasure: string;
  purchasePrice?: number | null;
  sellingPrice: number;
  quantityOnHand?: number | null;
  lowStockThreshold?: number | null;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface InventoryTransaction {
  id?: string;
  userId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  type: 'issue' | 'receive';
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  transactionDate: string;
  workOrderId?: string | null;
  workOrderNumber?: string | null;
  purchaseOrderId?: string | null;
  remarks?: string | null;
  createdByName?: string;
  actorUid: string;
  documentUrl?: string | null;
  linkedExpenseId?: string | null;
}

export interface EmailLog {
  id?: string;
  from: string;
  to: string;
  subject: string;
  timestamp: string;
  status: 'sent' | 'failed' | 'simulated';
  error?: string;
  fromUserId?: string;
}

export const MailingListSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MailingList = z.infer<typeof MailingListSchema>;

export const productOrServiceSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().min(1, "Description is required."),
  imageUrl: z.string().optional().nullable(),
});

export const GenerateMarketingContentInputSchema = z.object({
  userId: z.string(),
  contentName: z.string().min(3, "Content name is required."),
  prompt: z.string().min(10, "A detailed prompt is required to generate quality content."),
  companyId: z.string().optional(),
  products: z.array(productOrServiceSchema).optional(),
  isRegeneration: z.boolean().optional(),
  contentIdToUpdate: z.string().optional(),
});

export type GenerateMarketingContentInput = z.infer<typeof GenerateMarketingContentInputSchema>;

export const GenerateMarketingContentOutputSchema = z.object({
  subject: z.string(),
  htmlContent: z.string(),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
  contentId: z.string().optional(),
});

export type GenerateMarketingContentOutput = z.infer<typeof GenerateMarketingContentOutputSchema>;

export interface MailingListContent {
  id?: string;
  userId: string;
  contentName: string;
  subject: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
  companyId?: string | null;
  prompt?: string | null;
}

export interface MailingListCampaign {
  id?: string;
  userId: string;
  createdByName: string;
  createdAt: string;
  campaignName: string;
  contentId: string;
  mailingListIds: string[];
  status: 'draft' | 'sending' | 'sent';
  sentCount?: number;
  failedCount?: number;
  totalCost?: number;
}

export type MailingListEntryStatus = 'manual_entry' | 'signed_up' | 'contacted' | 'not_interested';
export const MAILING_LIST_STATUS_OPTIONS = ['manual_entry', 'signed_up', 'contacted', 'not_interested'] as const;

export interface MailingListEntry {
  id?: string;
  userId: string;
  email: string;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  status: MailingListEntryStatus;
  notes?: string | null;
  source: 'signup' | 'manual' | 'import';
  addedByUid: string;
  addedByName: string | null;
  createdAt: string;
  updatedAt: string;
  organizationId?: string | null;
  subcontractorId?: string | null;
  mailingListIds?: string[];
}
export interface Subcontractor {
  id?: string;
  userId: string;
  createdByName?: string;
  name: string;
  specialization: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  rating: number;
  notes?: string | null;
  status: 'active' | 'inactive' | 'on_hold';
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

export const FraudAnalysisInputSchema = z.object({
  dataOwnerId: z.string(),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});

export type FraudAnalysisInput = z.infer<typeof FraudAnalysisInputSchema>;

export type ChatMessage = {
  id?: string;
  userId: string;
  senderName: string;
  workOrderId: string;
  text: string;
  imageUrl?: string;
  fileName?: string | null;
  fileType?: string | null;
  timestamp: string;
  error?: boolean;
};

export interface WorkOrderWithLatestMessage extends WorkOrder {
  latestMessage: ChatMessage | null;
}

export interface DailyProgressReport {
  id?: string;
  userId: string;
  createdBy: string;
  createdByName: string;
  workOrderId: string;
  workOrderNumber: string;
  companyId: string;
  reportDate: string; // YYYY-MM-DD format
  workUpToYesterday: string;
  todaysPlanning: string;
  todaysWorkAllocation: string;
  todaysCompletion: string;
  workRating: number; // 1-10
  sitePhotos?: string[] | null;
  consumedItems?: DprConsumedItem[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceVisitReport {
  id?: string;
  userId: string;
  createdBy: string;
  createdByName: string;
  workOrderId: string;
  workOrderNumber: string;
  visitDate: string; // YYYY-MM-DD
  purposeOfVisit: string;
  actionsTaken: string;
  nextSteps?: string | null;
  clientFeedback?: string | null;
  visitRating: number; // 1-10
  consumedItems?: SvrConsumedItem[] | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string; // Added field
  updatedByName?: string; // Added field
}


export interface Portfolio {
  id?: string;
  userId: string;
  publicId: string;
  portfolioName: string;
  content: string;
  themeColor: string;
  companyId?: string | null;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioContact {
  id?: string;
  portfolioId: string;
  portfolioOwnerId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  createdAt: string;
}

export const GenerateBrandingInputSchema = z.object({
  userId: z.string(),
  companyId: z.string(),
  prompt: z.string().optional(),
  referenceImage: z.string().optional(),
  logoToRegenerate: z.string().optional(),
  regenerationPrompt: z.string().optional(),
  regenerateLogo: z.boolean().optional(),
  actorUid: z.string().optional(),
});

export type GenerateBrandingInput = z.infer<typeof GenerateBrandingInputSchema>;

export interface Letterhead {
  name: string;
  html: string;
  css: string;
}
export interface Letter {
  id?: string;
  userId: string;
  createdBy: string;
  documentType: 'Letter' | 'Certificate';
  recipient: string;
  subject: string;
  context: string;
  customFields?: { key: string; value: string }[];
  generatedTitle?: string | null;
  generatedContent?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface GenerateBrandingOutput {
  logos: string[];
  letterheads: Letterhead[];
  newResourcePoints?: number;
  error?: string;
}

export type AdvancedReportingData = any;
export type YearlyFinancialSummary = any;

// ────────────────────────────────────────────────
// Helper types
export interface EnrichedUserProfile {
  userProfile: UserProfile | null;
  teamMemberPermissions: TeamPermissions | null;
  teamOwnerProfileData: UserProfile | null;
}
export interface PaymentTransaction {
  id?: string;
  userId: string;
  userName?: string;
  orderId: string;
  paymentId: string;
  packageId: string;
  packageName: string;
  amountPaid: number;
  currency: 'INR';
  pointsAwarded: number;
  status: 'created' | 'captured' | 'failed';
  transactionDate: string;
  method: 'razorpay' | 'manual_grant';
  metadata?: {
    paymentType: 'coin_purchase' | 'support_contribution';
    actorUid?: string;
    actorName?: string;
    userEmail?: string;
    [key: string]: any;
  };
}


export interface DprConsumedItem {
  sourceType: 'work_order' | 'inventory' | 'purchase_order';
  sourceId: string;
  sourceName: string;
  workOrderItemId?: string;
  description: string;
  unit: string;
  consumedQuantity: number;
  rate: number;
  amount: number;
}

export type SvrConsumedItem = DprConsumedItem;