// src/types/index.ts
// Barrel file — shared types + safe constants
// Safe for BOTH client & server components

import type { User as FirebaseUser } from 'firebase/auth';

// ─── Firebase / Auth ────────────────────────────────────────────────
export type User = FirebaseUser;

// ─── Status & Option Arrays (client-safe) ───────────────────────────
export const PURCHASE_ORDER_STATUS_OPTIONS = [
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'partially_received',
  'received',
  'billed',
  'cancelled',
] as const;

export const USER_SUBMISSION_STATUS_OPTIONS = [
  'New',
  'Open',
  'In Progress',
  'Awaiting User Response',
  'Resolved',
  'Closed',
] as const;

export type UserSubmissionStatus = (typeof USER_SUBMISSION_STATUS_OPTIONS)[number];

export const USER_SUBMISSION_TYPE_OPTIONS = [
  'Query', 'Feedback', 'Bug Report', 'Feature Request'
] as const;

export type UserSubmissionType = (typeof USER_SUBMISSION_TYPE_OPTIONS)[number];

export const ESTIMATE_STATUS_OPTIONS = [
  'draft',
  'sent',
  'approved',
  'rejected',
  'expired',
] as const;

export const FOLLOW_UP_STATUS_OPTIONS = [
  'pending',
  'completed',
  'cancelled',
  'rescheduled',
] as const;

export const INVOICE_STATUS_OPTIONS = [
  'draft', 'sent', 'unpaid', 'paid', 'partially-paid', 'overdue', 'cancelled'
] as const;

export const WORK_ORDER_STATUS_OPTIONS = [
  'draft',
  'pending',
  'approved',
  'in-progress',
  'completed',
  'on-hold',
  'cancelled',
] as const;

export const ORGANIZATION_STATUS_OPTIONS = [
  'Lead',
  'Prospect',
  'Contacted',
  'Proposal Sent',
  'Negotiation',
  'Active Client',
  'On Hold',
  'Past Client',
  'Lost',
] as const;

export const ORGANIZATION_TYPES_OPTIONS = [
  'Government',
  'Non-Profit',
  'Educational',
  'Corporate',
  'Small Business',
  'Public Sector Unit (PSU)',
  'Healthcare',
  'Real Estate',
  'Consulting',
  'Individual',
  'Other',
] as const;

export const LEAD_SOURCE_OPTIONS = [
  'Referral',
  'Website',
  'Advertisement',
  'Cold Call',
  'Event',
  'Social Media',
  'Existing Client',
  'Other',
] as const;

export const MAILING_LIST_STATUS_OPTIONS = [
  'manual_entry',
  'signed_up',
  'contacted',
  'not_interested',
] as const;

export const LISTING_ITEM_TYPE_OPTIONS = [
  'buy',
  'sell',
  'exchange',
] as const;

export const LISTING_ITEM_STATUS_OPTIONS = [
  'active',
  'pending_review',
  'sold',
  'exchanged',
  'cancelled',
  'expired',
] as const;

export const DOCUMENT_TYPES_OPTIONS = [
  'Inward',
  'Outward',
  'Returnable',
  'Permit',
  'Measurement Sheet',
  'Item Bills',
  'Daily Progress Report',
  'Other',
] as const;

export const LICENSE_TYPES_OPTIONS = [
  'Trade License',
  'Labour License',
  'Electrical Contractor License',
  'GST Registration',
  'PAN Card',
  'TAN Registration',
  'ESI Registration',
  'EPF Registration',
  'Pollution Control Certificate',
  'Fire Safety Certificate',
  'Shop & Establishment License',
  'Professional Tax Registration',
  'Import Export Code (IEC)',
  'MSME Registration',
  'ISO Certification',
  'Other',
] as const;

export const EXPENSE_CATEGORY_OPTIONS = [
  'Materials',
  'Labour',
  'Subcontractor',
  'Fuel',
  'Equipment Rental',
  'Site Utilities',
  'Transportation',
  'Permits & Fees',
  'Office Supplies',
  'Marketing',
  'Travel',
  'Insurance',
  'Repair & Maintenance',
  'Bank Charges',
  'Taxes',
  'Labour Advance/Payment',
  'Other',
] as const;

// ─── Default / Config Constants ──────────────────────────────────────
export const DEFAULT_SIGNUP_RESOURCE_POINTS = 1000;

export const DEFAULT_COIN_PURCHASE_PACKAGES = [
  { id: 'pack_49', name: 'Starter Pack', amount: 49, points: 300, description: 'Get 300 Points for ₹49' },
  { id: 'pack_99', name: 'Value Pack', amount: 99, points: 1000, description: 'Get 1000 Points for ₹99' },
  { id: 'pack_299', name: 'Pro Pack', amount: 299, points: 3500, description: 'Get 3500 Points for ₹299' },
  { id: 'pack_499', name: 'Business Pack', amount: 499, points: 7000, description: 'Get 7000 Points for ₹499' },
  { id: 'pack_999', name: 'Enterprise Pack', amount: 999, points: 15000, description: 'Get 15000 Points for ₹999' },
  { id: 'pack_1999', name: 'Power User Pack', amount: 1999, points: 32000, description: 'Get 32000 Points for ₹1999' },
  { id: 'pack_3999', name: 'Agency Pack', amount: 3999, points: 65000, description: 'Get 65000 Points for ₹3999' },
] as const;

export const DEFAULT_SYSTEM_EMAILS = {
  noReply: 'noreply@coniv.in',
  support: 'support@coniv.in',
  business: 'business@coniv.in',
  contact: 'contact@coniv.in',
  info: 'info@coniv.in',
  marketing: 'marketing@coniv.in',
};

export const DEFAULT_SOCIAL_LINKS = {
  youtube: 'https://youtube.com',
  linkedin: 'https://linkedin.com',
  instagram: 'https://instagram.com',
  facebook: 'https://facebook.com',
  twitter: 'https://x.com',
};

export const DEFAULT_TERMS_AND_CONDITIONS = 'Your full terms and conditions text here...';
export const DEFAULT_PRIVACY_POLICY = 'Your full privacy policy text here...';

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

// ─── Client-safe Interfaces ──────────────────────────────────────────
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

export interface EnrichedUserProfile {
  userProfile: UserProfile | null;
  teamMemberPermissions: TeamPermissions | null;
  teamOwnerProfileData: UserProfile | null;
}

// ─── Safe Re-exports from server-only (ONLY TYPES) ───────────────────
export type {
  AppConfiguration,
  AppConfigActionCost,
  AppConfigCoinPurchasePackage,
  SystemEmails,
  EmailTemplates,
  SocialLinks,
  TemporaryBanner,
  Company,
  BankAccount,
  Organization,
  OrganizationType,
  OrganizationStatusType,
  LeadSourceType,
  FollowUp,
  FollowUpStatus,
  Estimate,
  EstimateItem,
  EstimateStatus,
  WorkOrder,
  WorkOrderItem,
  WorkOrderStatus,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  OtherDeduction,
  SorRate,
  LabourRegister,
  LabourAttendance,
  LabourAdvance,
  LabourTimeLog,
  Document,
  DocumentType,
  License,
  LicenseType,
  Expense,
  ExpenseCategory,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  ListingItem,
  ListingItemType,
  ListingItemStatus,
  DigitalBusinessCard,
  InventoryItem,
  InventoryTransaction,
  Task,
  Letter,
  ChatMessage,
  DailyProgressReport,
  DprConsumedItem,
  ServiceVisitReport,
  SvrConsumedItem,
  Portfolio,
  PortfolioContact,
  MailingList,
  MailingListEntry,
  MailingListEntryStatus,
  MailingListContent,
  MailingListCampaign,
  Subcontractor,
  ActivityLog,
  ActivityLogActionType,
  ActivityLogEntityType,
  AlertItem,
  PaymentTransaction,
  TeamMember,
  TeamInvitation,
  WorkOrderProfitLoss,
  AISuggestedEstimateItem,
} from './server-only';

// ─── Placeholders ────────────────────────────────────────────────────
export type GeneratePortfolioInput = any;
export type GeneratePortfolioOutput = any;