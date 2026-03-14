import { 
  FileText, ClipboardList, Receipt, HardHat, FileArchive, 
  Landmark, ListOrdered, Award, Users, ShieldCheck, 
  Briefcase, CreditCard, Package, UserCog, ShoppingCart, 
  Activity, FileClock, Wrench, Bot, ScanSearch, ShieldAlert, 
  Store, QrCode, MessageSquare, FileSignature, TrendingUp,
  Target, MailWarning, DollarSign, GanttChart, Sunrise, HelpCircle,
  Construction, Sparkles
} from 'lucide-react';

/**
 * @fileOverview Metadata for grouping and displaying team permissions.
 */

export const permissionGroups = [
  {
    title: "Estimates",
    icon: FileText,
    permissions: [
      { id: "canViewEstimates", label: "View Estimates" },
      { id: "canCreateEstimates", label: "Create Estimates" },
      { id: "canEditEstimates", label: "Edit Estimates" },
      { id: "canDeleteEstimates", label: "Delete Estimates" },
      { id: "canChangeEstimateStatus", label: "Approve/Reject Estimates" },
    ],
  },
  {
    title: "Work Orders",
    icon: ClipboardList,
    permissions: [
      { id: "canViewWorkOrders", label: "View Work Orders" },
      { id: "canCreateWorkOrders", label: "Create Work Orders" },
      { id: "canEditWorkOrders", label: "Edit Work Orders" },
      { id: "canDeleteWorkOrders", label: "Delete Work Orders" },
      { id: "canChangeWorkOrderStatus", label: "Update WO Status" },
    ],
  },
  {
    title: "Invoices",
    icon: Receipt,
    permissions: [
      { id: "canViewInvoices", label: "View Invoices" },
      { id: "canCreateInvoices", label: "Create Invoices" },
      { id: "canEditInvoices", label: "Edit Invoices" },
      { id: "canDeleteInvoices", label: "Delete Invoices" },
      { id: "canChangeInvoiceStatus", label: "Mark Invoices Paid" },
    ],
  },
  {
    title: "Labour & On-Site",
    icon: HardHat,
    permissions: [
      { id: "canManageLabourRegister", label: "Manage Labour List" },
      { id: "canRecordLabourAttendance", label: "Mark Attendance" },
      { id: "canManageLabourPayments", label: "Log Payments/Advances" },
      { id: "canManageDpr", label: "Log Daily Progress (DPR)" },
      { id: "canManageSvr", label: "Log Service Visits (SVR)" },
    ],
  },
  {
    title: "Procurement & Stock",
    icon: ShoppingCart,
    permissions: [
      { id: "canCreatePurchaseOrders", label: "Create POs" },
      { id: "canViewPurchaseOrders", label: "View POs" },
      { id: "canEditPurchaseOrders", label: "Edit POs" },
      { id: "canDeletePurchaseOrders", label: "Delete POs" },
      { id: "canManageInventory", label: "Manage Inventory" },
      { id: "canManageSubcontractors", label: "Manage Subcontractors" },
    ],
  },
  {
    title: "Resources & Assets",
    icon: Briefcase,
    permissions: [
      { id: "canManageCompanies", label: "Manage Companies" },
      { id: "canManageOrganizations", label: "Manage Clients/Orgs" },
      { id: "canManageBankAccounts", label: "Manage Bank Details" },
      { id: "canManageOwnerLicenses", label: "Manage Licenses" },
      { id: "canManageOwnerSORs", label: "Manage SOR Rates" },
      { id: "canManageDocuments", label: "Manage File Library" },
    ],
  },
  {
    title: "AI & Intelligence",
    icon: Bot,
    permissions: [
      { id: "canUseAiDailyBriefing", label: "Daily Briefing" },
      { id: "canUseAiEstimateGeneration", label: "AI Estimate Help" },
      { id: "canUseAiRiskAssessment", label: "AI Risk Assessment" },
      { id: "canUseAiDocumentAnalysis", label: "AI OCR/Doc Analysis" },
      { id: "canRunAudits", label: "Run Automated Audits" },
      { id: "canUseAiFinancialHealthCheck", label: "Financial Health Check" },
      { id: "canUseAiLaborAnalysis", label: "Labor Analysis" },
      { id: "canUseAiBidAdvisor", label: "Bid/No-Bid Advisor" },
      { id: "canUseAiSafetyCompliance", label: "Safety Compliance" },
      { id: "canUseAiProjectScheduler", label: "Project Scheduler" },
      { id: "canUseAiCashFlowForecaster", label: "Cash Flow Forecast" },
      { id: "canUseAiSmartCollections", label: "Smart Collections" },
      { id: "canUseAiFraudDetector", label: "Fraud Detection" },
      { id: "canUseAiExpenseAnomaly", label: "Expense Anomaly" },
      { id: "canUseAiMaterialsForecaster", label: "Materials Forecast" },
      { id: "canUseAiTeamPerformance", label: "Performance Analyst" },
      { id: "canUseAiQaAuditor", label: "Q&A Auditor Access" },
    ],
  },
  {
    title: "System & Management",
    icon: UserCog,
    permissions: [
      { id: "canManageTeam", label: "Team Supervisor (Invite/Perms)" },
      { id: "canViewActivityLog", label: "View Activity Audit Log" },
      { id: "canViewFinancialSummaries", label: "View All Reports" },
      { id: "canManageDigitalBusinessCards", label: "Manage Digital Cards" },
      { id: "canManageListings", label: "Manage Marketplace" },
      { id: "canUseProjectChat", label: "Use Project Chat" },
      { id: "canGenerateLetters", label: "Generate Documents" },
    ],
  },
];
