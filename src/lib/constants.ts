// src/lib/constants.ts
// Client + server safe constants, costs, options, nav, etc.

import type { NavItem as NavItemFromServer, EmailTemplates } from '@/types/server-only';
export type NavItem = NavItemFromServer;

export const APP_NAME = "CONIV";
export const NEXT_PUBLIC_RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

// ────────────────────────────────────────────────
// Navigation
export const NAV_ITEMS: NavItemFromServer[] = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { title: "Alerts", href: "/dashboard/alerts", icon: "AlertTriangle", color: "text-red-500" },
  {
    title: "Core Operations", href: "#", icon: "Construction",
    children: [
      { title: "Estimates", href: "/dashboard/estimates", icon: "FileText", color: "text-blue-500" },
      { title: "Work Orders", href: "/dashboard/work-orders", icon: "ClipboardList", color: "text-green-500" },
      { title: "Project Chat", href: "/dashboard/chat", icon: "MessageSquare", color: "text-cyan-500" },
      { title: "Follow-ups", href: "/dashboard/follow-ups", icon: "MessageSquare", color: "text-pink-500" },
      { title: "Daily Progress Reports", href: "/dashboard/dpr", icon: "FileClock", color: "text-teal-500" },
      { title: "Service Visit Reports", href: "/dashboard/svr", icon: "Wrench", color: "text-sky-500" },
    ],
  },
  {
    title: "Financials", href: "#", icon: "IndianRupee",
    children: [
      { title: "Invoices", href: "/dashboard/invoices", icon: "Receipt", color: "text-red-500" },
      { title: "Expense Tracking", href: "/dashboard/expenses", icon: "CreditCard", color: "text-red-500" },
      { title: "Purchase Orders", href: "/dashboard/advance-tools/purchase-orders", icon: "ShoppingCart", color: "text-rose-500" },
      {
        title: "Reports", href: "#", icon: "BarChart3",
        children: [
          { title: "Financial Summary", href: "/dashboard/financial-summary", icon: "PieChart", color: "text-green-500" },
          { title: "Project Profitability", href: "/dashboard/reports/work-order-profitability", icon: "TrendingUp" },
          { title: "Estimate vs. Actuals", href: "/dashboard/reports/estimate-vs-actuals", icon: "Target" },
          { title: "Labour Cost Analysis", href: "/dashboard/reports/labour-cost-analysis", icon: "HardHat" },
          { title: "Materials Consumption", href: "/dashboard/reports/materials-consumption", icon: "Package" },
        ]
      }
    ]
  },
  {
    title: "Resource Management", href: "#", icon: "Package",
    children: [
      { title: "Companies", href: "/dashboard/companies", icon: "Building2", color: "text-orange-500" },
      { title: "Organizations", href: "/dashboard/organizations", icon: "Users", color: "text-indigo-500" },
      { title: "Labour Register", href: "/dashboard/labour-register", icon: "HardHat", color: "text-yellow-600" },
      { title: "Subcontractors", href: "/dashboard/subcontractors", icon: "Users", color: "text-cyan-500" },
      { title: "Documents", href: "/dashboard/documents", icon: "FileArchive", color: "text-purple-500" },
      { title: "Bank Accounts", href: "/dashboard/bank-accounts", icon: "Landmark", color: "text-gray-500" },
      { title: "Licenses", href: "/dashboard/licenses", icon: "Award", color: "text-pink-500" },
      { title: "SOR Rates", href: "/dashboard/sor-rates", icon: "ListOrdered", color: "text-gray-500" },
      { title: "Inventory", href: "/dashboard/inventory", icon: "Package", color: "text-lime-500" },
    ],
  },
  {
    title: "Marketing", href: "#", icon: "Megaphone",
    children: [
      { title: "Mailing Lists & Campaigns", href: "/dashboard/marketing/mailing-list", icon: "Mail", color: "text-cyan-500"},
      { title: "Content", href: "/dashboard/marketing/content", icon: "FileText", color: "text-blue-500"},
    ]
  },
  {
    title: "Advanced Tools", href: "/dashboard/advance-tools", icon: "Sparkles", color: "text-amber-500",
    children: [
      { title: 'AI Tools', href: '/dashboard/advance-tools', icon: 'Bot', color: 'text-rose-500' },
      { title: 'Public Portfolios', href: '/dashboard/portfolios', icon: 'Workflow', color: 'text-rose-500' },
      { title: "Gantt Charts", href: "/dashboard/gantt-charts", icon: "GanttChart", color: 'text-indigo-500' },
      { title: 'Time Tracking', href: '/dashboard/advance-tools/time-tracking', icon: 'Clock', color: 'text-violet-500' },
      { title: "QR Business Card", href: "/dashboard/advance-tools/qr-business-card", icon: "QrCode", color: 'text-gray-500' },
      { title: "Buy/Sell/Exchange", href: "/dashboard/advance-tools/buy-sell-exchange", icon: "Store", color: 'text-lime-600' },
      { title: "Activity Log", href: "/dashboard/advance-tools/activity-log", icon: "Activity", color: 'text-teal-500' },
      { title: "Letter & Certificate Generation", href: "/dashboard/letter-generation", icon: "FileSignature", color: 'text-purple-500' },
    ]
  },
  {
    title: "Account & Settings", href: "#", icon: "Settings",
    children: [
      { title: "My Profile", href: "/dashboard/profile", icon: "UserCog", color: "text-gray-500" },
      { title: "Manage Team", href: "/dashboard/team", icon: "Users", color: "text-blue-500" },
      { title: "Coins & Payments", href: "/dashboard/coins-payments", icon: "Coins", color: "text-amber-500" },
      { title: "Settings", href: "/dashboard/settings", icon: "Settings", color: "text-gray-500" },
      { title: "Email Logs", href: "/dashboard/email-logs", icon: "Mail", color: "text-cyan-500" },
      { title: "Support Us", href: "/dashboard/support-us", icon: "Heart", color: "text-red-500" },
      { title: "Workflow Guide", href: "/dashboard/workflow-guide", icon: "MapIcon", color: "text-teal-500" },
      { title: "Install App", href: "/dashboard/install", icon: "Download", color: "text-green-500", isInstallButton: true },
      { title: "Help & Support", href: "/dashboard/help-support", icon: "MessageSquare", color: "text-purple-500" },
    ],
  },
  {
    title: 'Admin Panel', href: '/dashboard/admin', icon: 'ShieldCheck', isAdmin: true,
    children: [
      { title: "App Configuration", href: "/dashboard/admin/app-configuration", icon: 'Settings' },
      { title: "User Management", href: "/dashboard/admin/user-management", icon: 'Users' },
      { title: "Payment Transactions", href: "/dashboard/admin/payment-transactions", icon: 'CreditCard' },
      { title: "Support Submissions", href: "/dashboard/admin/user-submissions", icon: 'MessageSquare' },
      { title: "Admin Email Logs", href: "/dashboard/admin/email-logs", icon: 'MailWarning' },
      { title: "Admin Mailing List", href: "/dashboard/admin/mailing-list", icon: 'Mail' },
    ]
  }
];

// ────────────────────────────────────────────────
// ACTION_COSTS_DISPLAY
export const ACTION_COSTS_DISPLAY = [
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

// ────────────────────────────────────────────────
// Individual cost constants
export const DEFAULT_SIGNUP_RESOURCE_POINTS = 1000;
export const ESTIMATE_CREATION_COST = 8;
export const WORK_ORDER_CREATION_COST = 10;
export const INVOICE_CREATION_COST = 8;
export const COMPANY_CREATION_COST = 10;
export const BANK_ACCOUNT_CREATION_COST = 5;
export const ORGANIZATION_CREATION_COST = 5;
export const FOLLOW_UP_CREATION_COST = 2;
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
// Status & options arrays
export const EXPENSE_CATEGORY_OPTIONS = [
  "Materials", "Fuel", "Labour", "Subcontractor", "Equipment", "Travel", "Office", "Taxes", "Insurance", "Utilities", "Other"
] as const;

export const PURCHASE_ORDER_STATUS_OPTIONS = ["draft", "pending_approval", "approved", "ordered", "partially_received", "received", "billed", "cancelled"] as const;

export const MAILING_LIST_STATUS_OPTIONS = ["manual_entry", "signed_up", "contacted", "not_interested"] as const;

export const ORGANIZATION_STATUS_OPTIONS = ["Active", "Inactive", "Lead", "Archived"] as const;
export const LEAD_SOURCE_OPTIONS = ["Referral", "Website", "Expo", "Social Media", "Direct Outreach", "Other"] as const;
export const ORGANIZATION_TYPES_OPTIONS = ["Company", "Individual", "Government", "NPO", "Other"] as const;

export const DOCUMENT_TYPES_OPTIONS = ['Inward', 'Outward', 'Returnable', 'Permit', 'Measurement Sheet', 'Item Bills', 'Daily Progress Report', 'Other'] as const;

export const LICENSE_TYPES_OPTIONS = ["Business", "Professional", "Safety", "Environmental", "Other"] as const;

export const ESTIMATE_STATUS_OPTIONS = ['draft', 'submitted', 'approved', 'rejected', 'expired'] as const;

export const INVOICE_STATUS_OPTIONS = ['draft', 'sent', 'paid', 'unpaid', 'overdue', 'cancelled', 'partially-paid'] as const;

export const WORK_ORDER_STATUS_OPTIONS = ['draft', 'pending', 'approved', 'in-progress', 'completed', 'on-hold', 'cancelled'] as const;

export const FOLLOW_UP_STATUS_OPTIONS = ['pending', 'completed', 'cancelled'] as const;

export const LISTING_ITEM_TYPE_OPTIONS = ['sell', 'buy', 'exchange'] as const;
export const LISTING_ITEM_STATUS_OPTIONS = ['active', 'sold', 'expired', 'removed'] as const;

// ────────────────────────────────────────────────
// UI / Misc constants
export const CHART_COLORS = ["#2563eb", "#f97316", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

export const DEFAULT_COIN_PURCHASE_PACKAGES = [
  { id: 'pack_49', name: 'Starter Pack', amount: 49, points: 300, description: 'Get 300 Points for ₹49' },
  { id: 'pack_99', name: 'Value Pack', amount: 99, points: 1000, description: 'Get 1000 Points for ₹99' },
  { id: 'pack_299', name: 'Pro Pack', amount: 299, points: 3500, description: 'Get 3500 Points for ₹299' },
  { id: 'pack_499', name: 'Business Pack', amount: 499, points: 7000, description: 'Get 7000 Points for ₹499' },
  { id: 'pack_999', name: 'Enterprise Pack', amount: 999, points: 15000, description: 'Get 15000 Points for ₹999' },
  { id: 'pack_1999', name: 'Power User Pack', amount: 1999, points: 32000, description: 'Get 32000 Points for ₹1999' },
  { id: 'pack_3999', name: 'Agency Pack', amount: 3999, points: 65000, description: 'Get 65000 Points for ₹3999' },
];

export const DEFAULT_SYSTEM_EMAILS = {
  noReply: "noreply@coniv.in",
  support: "support@coniv.in",
  business: "business@coniv.in",
  contact: "contact@coniv.in",
  info: "info@coniv.in",
  marketing: "marketing@coniv.in"
};

export const DEFAULT_SOCIAL_LINKS = {
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

// ────────────────────────────────────────────────
// Email Templates
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

export const EMAIL_TEMPLATE_METADATA: { [key in keyof EmailTemplates]: { title: string; description: string; } } = {
  userSignupOtp: { title: "User Signup OTP", description: "Email sent with OTP for new user email verification." },
  passwordResetOtp: { title: "Password Reset OTP", description: "Email sent with OTP for resetting a user's password." },
  purchaseConfirmation: { title: "Purchase Confirmation", description: "Email sent to a user after they successfully purchase resource points." },
  userAlert: { title: "Generic User Alert", description: "A general-purpose alert email sent to a user." },
  generalBusiness: { title: "General Business Communication", description: "General business announcements or information." },
  supportResponse: { title: "Support Ticket Response", description: "Response sent to a user regarding their support submission." },
  weeklyTopAlerts: { title: "Weekly Top Alerts Digest", description: "A weekly summary of the most important system-generated alerts for a user." },
  weeklyInvoiceFollowups: { title: "Weekly Invoice Follow-ups Digest", description: "A weekly summary of overdue invoices for a user to follow up on." },
  weeklySecurityDepositFollowups: { title: "Weekly Security Deposit Digest", description: "A weekly reminder for security deposits that are due for return." },
  weeklyFinancialSummary: { title: "Weekly Financial Summary Digest", description: "A weekly email summarizing the user's financial performance." },
  weeklyLicensesDue: { title: "Weekly License Renewal Digest", description: "A weekly list of licenses that are nearing their expiry date." }
};

export const DEFAULT_TEAM_PERMISSIONS = {
  canManageTeam: false,
  canViewEstimates: true,
  canCreateEstimates: false,
  canEditEstimates: false,
  canDeleteEstimates: false,
  canChangeEstimateStatus: false,
  canViewWorkOrders: true,
  canCreateWorkOrders: false,
  canEditWorkOrders: false,
  canDeleteWorkOrders: false,
  canChangeWorkOrderStatus: false,
  canViewInvoices: true,
  canCreateInvoices: false,
  canEditInvoices: false,
  canDeleteInvoices: false,
  canChangeInvoiceStatus: false,
  canManageLabourRegister: false,
  canRecordLabourAttendance: true,
  canManageLabourPayments: false,
  canManageTimeTracking: true,
  canManageDocuments: true,
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
  canViewPurchaseOrders: true,
  canEditPurchaseOrders: false,
  canDeletePurchaseOrders: false,
  canChangePurchaseOrderStatus: false,
  canManageInventory: false,
  canManageDigitalBusinessCards: false,
  canManageListings: false,
  canUseAiEstimateGeneration: false,
  canUseAiDocumentAnalysis: false,
  canUseAiRiskAssessment: false,
  canManageDpr: true,
  canManageSvr: true,
  canUseProjectChat: true,
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
  canManageMailingList: false,
};