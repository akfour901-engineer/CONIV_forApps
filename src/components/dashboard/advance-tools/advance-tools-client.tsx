
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, MapIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { TeamPermissions } from '@/types';
import { useLoading } from '@/contexts/loading-context';
import { ShieldCheck, Activity, ScanSearch, ShieldAlert, Clock, BarChart3, QrCode, Store, FileSignature, HardHat, TrendingUp, GanttChart, DollarSign, Target, MailWarning, Users, Package, HelpCircle, Sunrise, ClipboardList, FileText, Receipt, CreditCard, UserCog, FileArchive, Award, Settings, Workflow } from "lucide-react";

interface AdvanceFeature {
  name: string;
  description: string;
  category: 'AI Powered';
  icon: LucideIcon;
  href?: string;
  status?: 'Planned' | 'In Development' | 'Available' | 'Available (Basic Charts Implemented)' | 'Available (Basic OCR)' | 'Available (Beta)';
  requiredPermission?: keyof TeamPermissions;
}

const advanceFeaturesList: AdvanceFeature[] = [
  // AI Powered
  {
    name: "Audit Tool",
    href: "/dashboard/advance-tools/audit",
    description: "Utilize AI to review company activities, identify potential errors, and suggest corrections based on records and economic data.",
    category: 'AI Powered',
    icon: ShieldCheck,
    status: 'Available',
    requiredPermission: 'canRunAudits',
  },
  {
    name: "AI-Powered Estimate Generation",
    href: "/dashboard/advance-tools/ai-estimate-generation",
    description: "Input a project scope, and an AI flow will suggest potential line items for your estimate.",
    category: 'AI Powered',
    icon: Bot,
    status: 'Available',
    requiredPermission: 'canUseAiEstimateGeneration',
  },
  {
    name: "AI Document Analysis (OCR)",
    href: "/dashboard/advance-tools/ai-document-analysis",
    description: "Extract key information from uploaded documents like invoices and plans using AI and OCR.",
    category: 'AI Powered',
    icon: ScanSearch,
    status: 'Available',
    requiredPermission: 'canUseAiDocumentAnalysis',
  },
  {
    name: "AI Risk Assessment",
    href: "/dashboard/advance-tools/ai-risk-assessment",
    description: "AI analyzes Estimates or Work Orders to flag potential risks like vague scope or unusual pricing patterns.",
    category: 'AI Powered',
    icon: ShieldAlert,
    status: 'Available',
    requiredPermission: 'canUseAiRiskAssessment',
  },
   {
    name: "Letter & Certificate Generation",
    href: "/dashboard/letter-generation",
    description: "Generate professional letters and certificates for various business needs using AI.",
    category: 'AI Powered',
    icon: FileSignature,
    status: 'Available',
    requiredPermission: 'canGenerateLetters', 
  },
  {
    name: "AI Work Order Analysis",
    href: "/dashboard/advance-tools/ai-work-order-analysis",
    description: "Get AI-driven suggestions for improving a work order's execution and efficiency based on all linked data.",
    category: 'AI Powered',
    icon: Bot,
    status: 'Available',
    requiredPermission: 'canRunAudits',
  },
  {
    name: "AI Financial Health Check",
    href: "/dashboard/advance-tools/ai-financial-health-check",
    description: "An AI-powered overview of your company's financial status, highlighting urgent actions and areas for improvement.",
    category: 'AI Powered',
    icon: TrendingUp,
    status: 'Available',
    requiredPermission: 'canViewFinancialSummaries',
  },
  {
    name: "AI Labor Analysis",
    href: "/dashboard/advance-tools/ai-labor-analysis",
    description: "Analyze labor data for a project to get insights on efficiency, cost, and potential discrepancies.",
    category: 'AI Powered',
    icon: HardHat,
    status: 'Available',
    requiredPermission: 'canViewFinancialSummaries',
  },
  {
    name: "AI Bid/No-Bid Advisor",
    href: "/dashboard/advance-tools/ai-bid-advisor",
    description: "Analyzes new project scopes against your history to recommend whether to bid, focusing your efforts.",
    category: 'AI Powered',
    icon: Target,
    status: 'Available',
    requiredPermission: 'canRunAudits',
  },
  {
    name: "AI Safety Compliance Officer",
    href: "/dashboard/advance-tools/ai-safety-compliance",
    description: "Analyzes DPRs and SVRs for safety keywords to proactively flag potential compliance issues and hazards.",
    category: 'AI Powered',
    icon: ShieldAlert,
    status: 'Available',
    requiredPermission: 'canRunAudits',
  },
  {
    name: "AI Project Scheduler",
    href: "/dashboard/advance-tools/ai-project-scheduler",
    description: "Generates a preliminary project schedule and Gantt chart from your Work Order's scope and line items.",
    category: 'AI Powered',
    icon: GanttChart,
    status: 'Available',
    requiredPermission: 'canViewFinancialSummaries',
  },
  {
    name: "AI Cash Flow Forecaster",
    href: "/dashboard/advance-tools/ai-cash-flow-forecaster",
    description: "Analyzes receivables and payables to provide a short-term cash flow forecast, helping anticipate financial needs.",
    category: 'AI Powered',
    icon: DollarSign,
    status: 'Available',
    requiredPermission: 'canViewFinancialSummaries',
  },
  {
    name: "AI Smart Collections Agent",
    href: "/dashboard/advance-tools/ai-smart-collections",
    description: "Automatically drafts and suggests follow-up emails for overdue invoices to improve cash flow.",
    category: 'AI Powered',
    icon: MailWarning,
    status: 'Available',
    requiredPermission: 'canViewInvoices',
  },
  {
    name: "AI Fraudulent Activity Detector",
    href: "/dashboard/advance-tools/ai-fraud-detector",
    description: "Monitors the Activity Log to flag suspicious behavior and potential security threats.",
    category: 'AI Powered',
    icon: ShieldAlert,
    status: 'Available',
    requiredPermission: 'canRunAudits',
  },
  {
    name: "AI Expense Anomaly Detection",
    href: "/dashboard/advance-tools/ai-expense-anomaly-detection",
    description: "Monitors expenses to flag unusual transactions, helping to identify potential fraud or waste.",
    category: 'AI Powered',
    icon: ShieldAlert,
    status: 'Available',
    requiredPermission: 'canViewFinancialSummaries',
  },
  {
    name: "AI Materials Forecaster",
    href: "/dashboard/advance-tools/ai-materials-forecaster",
    description: "Analyzes upcoming Work Orders against current inventory to predict material shortages and optimize procurement.",
    category: 'AI Powered',
    icon: Package,
    status: 'Available',
    requiredPermission: 'canViewFinancialSummaries',
  },
  {
    name: "AI Team Performance Analyst",
    href: "/dashboard/advance-tools/ai-team-performance",
    description: "Identifies patterns in the Activity Log to provide data-driven insights into team efficiency and project bottlenecks.",
    category: 'AI Powered',
    icon: Users,
    status: 'Available',
    requiredPermission: 'canViewActivityLog',
  },
  {
    name: "AI Q&A Auditor",
    href: "/dashboard/advance-tools/ai-q-and-a-auditor",
    description: "Ask natural language questions about your finances, like 'What were my total material costs last month?'.",
    category: 'AI Powered',
    icon: HelpCircle,
    status: 'Available',
    requiredPermission: 'canRunAudits',
  },
  {
    name: "AI Daily Briefing",
    href: "/dashboard/advance-tools/ai-daily-briefing",
    description: "Generates a concise summary of your day's most critical alerts, deadlines, and required actions.",
    category: 'AI Powered',
    icon: Sunrise,
    status: 'Available',
    requiredPermission: 'canViewFinancialSummaries',
  },
   {
    name: "AI Portfolio Generator",
    href: "/dashboard/advance-tools/ai-portfolio-generator",
    description: "Automatically create a professional public-facing portfolio page based on your company's completed projects.",
    category: 'AI Powered',
    icon: Workflow,
    status: 'Available',
    requiredPermission: 'canManageCompanies',
  },
];

const categories: AdvanceFeature['category'][] = ['AI Powered'];

export default function AdvanceToolsClientPage() {
  const { currentTeamMemberPermissions, isViewingOwnAccount } = useAuth();
  const { setIsLoading } = useLoading();

  const canAccessTool = (permissionKey?: keyof TeamPermissions) => {
    if (isViewingOwnAccount) return true;
    if (!permissionKey) return true;
    return !!currentTeamMemberPermissions?.[permissionKey];
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Bot className="mr-3 h-7 w-7 text-primary" /> AI Tools
          </h1>
          <p className="text-muted-foreground">
            Explore powerful AI-driven modules to enhance your workflow.
          </p>
        </div>
      </div>
      
      <Card className="shadow-md border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center"><MapIcon className="mr-2 h-5 w-5"/>New to these tools?</CardTitle>
          <CardDescription>
            Our workflow guide explains what each tool does and how it fits into your business process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild onClick={() => setIsLoading(true)}>
            <Link href="/dashboard/workflow-guide">
              <span className="flex items-center">Open Workflow Guide <ArrowRight className="ml-2 h-4 w-4"/></span>
            </Link>
          </Button>
        </CardContent>
      </Card>

      {categories.map(category => {
        const featuresInCategory = advanceFeaturesList.filter(feature => feature.category === category && canAccessTool(feature.requiredPermission));
        if (featuresInCategory.length === 0) return null;

        return (
          <div key={category} className="space-y-4">
            <h2 className="text-xl font-semibold text-primary border-b pb-2">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuresInCategory.map((feature) => (
                <Card
                  key={feature.name}
                  className={`hover:shadow-md transition-shadow h-full flex flex-col ${
                    feature.status?.startsWith('Available') ? 'border-green-500/50 ring-1 ring-green-500/20 shadow-sm' :
                    'border-amber-500/50 ring-1 ring-amber-500/20 shadow-sm'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <feature.icon className="mr-2 h-5 w-5 text-primary/80 flex-shrink-0" />
                      {feature.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center pt-3">
                    {feature.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          feature.status?.startsWith('Available') ? 'bg-green-100 text-green-700' :
                          feature.status?.startsWith('In Development') ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                            {feature.status}
                        </span>
                    )}
                    {feature.href && feature.href !== "#" ? (
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 text-xs" asChild>
                        <Link href={feature.href} onClick={() => setIsLoading(true)}>
                          Access Tool <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" disabled>
                        Coming Soon
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
