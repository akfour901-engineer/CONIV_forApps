
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from '@/components/ui/separator';
import type { TeamMember, TeamPermissions } from '@/types/server-only';
import { DEFAULT_TEAM_PERMISSIONS } from '@/types/server-only';
import { Save, Loader2, X, FileText, ClipboardList, Receipt, HardHat, FileArchive, Landmark, ListOrdered, Award, Users, ShieldCheck, Briefcase, CreditCard, Package, UserCog, ShoppingCart, Activity, FileClock, Wrench, Bot, ScanSearch, ShieldAlert, Store, QrCode, MessageSquare, Construction } from 'lucide-react';
import { permissionGroups } from '@/lib/permissions';

const permissionsSchema = z.object({
  canManageTeam: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageTeam),
  canViewEstimates: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canViewEstimates),
  canCreateEstimates: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canCreateEstimates),
  canEditEstimates: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canEditEstimates),
  canDeleteEstimates: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canDeleteEstimates),
  canChangeEstimateStatus: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canChangeEstimateStatus),
  canViewWorkOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canViewWorkOrders),
  canCreateWorkOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canCreateWorkOrders),
  canEditWorkOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canEditWorkOrders),
  canDeleteWorkOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canDeleteWorkOrders),
  canChangeWorkOrderStatus: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canChangeWorkOrderStatus),
  canViewInvoices: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canViewInvoices),
  canCreateInvoices: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canCreateInvoices),
  canEditInvoices: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canEditInvoices),
  canDeleteInvoices: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canDeleteInvoices),
  canChangeInvoiceStatus: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canChangeInvoiceStatus),
  canManageLabourRegister: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageLabourRegister),
  canRecordLabourAttendance: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canRecordLabourAttendance),
  canManageLabourPayments: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageLabourPayments),
  canManageTimeTracking: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageTimeTracking),
  canManageDocuments: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageDocuments),
  canManageCompanies: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageCompanies),
  canManageBankAccounts: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageBankAccounts),
  canManageOwnerLicenses: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageOwnerLicenses),
  canManageOwnerSORs: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageOwnerSORs),
  canManageOrganizations: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageOrganizations),
  canManageExpenses: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageExpenses),
  canViewFinancialSummaries: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canViewFinancialSummaries),
  canRunAudits: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canRunAudits),
  canViewActivityLog: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canViewActivityLog),
  canCreatePurchaseOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canCreatePurchaseOrders),
  canViewPurchaseOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canViewPurchaseOrders),
  canEditPurchaseOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canEditPurchaseOrders),
  canDeletePurchaseOrders: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canDeletePurchaseOrders),
  canChangePurchaseOrderStatus: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canChangePurchaseOrderStatus),
  canManageInventory: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageInventory),
  canManageDigitalBusinessCards: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageDigitalBusinessCards),
  canManageListings: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageListings),
  canUseAiEstimateGeneration: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiEstimateGeneration),
  canUseAiDocumentAnalysis: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiDocumentAnalysis),
  canUseAiRiskAssessment: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiRiskAssessment),
  canManageDpr: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageDpr),
  canManageSvr: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageSvr),
  canUseProjectChat: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseProjectChat),
  canManageSubcontractors: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canManageSubcontractors),
  canGenerateLetters: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canGenerateLetters),
  canUseAiWoAnalysis: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiWoAnalysis),
  canUseAiFinancialHealthCheck: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiFinancialHealthCheck),
  canUseAiLaborAnalysis: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiLaborAnalysis),
  canUseAiBidAdvisor: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiBidAdvisor),
  canUseAiSafetyCompliance: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiSafetyCompliance),
  canUseAiProjectScheduler: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiProjectScheduler),
  canUseAiCashFlowForecaster: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiCashFlowForecaster),
  canUseAiSmartCollections: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiSmartCollections),
  canUseAiFraudDetector: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiFraudDetector),
  canUseAiExpenseAnomaly: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiExpenseAnomaly),
  canUseAiMaterialsForecaster: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiMaterialsForecaster),
  canUseAiTeamPerformance: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiTeamPerformance),
  canUseAiQaAuditor: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiQaAuditor),
  canUseAiDailyBriefing: z.boolean().default(DEFAULT_TEAM_PERMISSIONS.canUseAiDailyBriefing),
});


type PermissionsFormValues = z.infer<typeof permissionsSchema>;

interface EditPermissionsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onSave: (memberUid: string, permissions: TeamPermissions) => Promise<void>;
  isProcessing?: boolean;
}


export default function EditPermissionsModal({
  isOpen,
  onOpenChange,
  member,
  onSave,
  isProcessing = false,
}: EditPermissionsModalProps) {
  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: member?.permissions ? { ...member.permissions } : { ...DEFAULT_TEAM_PERMISSIONS },
  });

  useEffect(() => {
    if (member) {
      form.reset(member.permissions ? { ...member.permissions } : { ...DEFAULT_TEAM_PERMISSIONS });
    }
  }, [member, form, isOpen]);
  
  const onSubmit = (values: PermissionsFormValues) => {
    if (member) {
      onSave(member.memberUid, values as TeamPermissions);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>Edit Permissions for {member.name}</DialogTitle>
          <DialogDescription>
            Select the modules and actions this member will be authorized for.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
          <Form {...form}>
            <form id="edit-permissions-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {permissionGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-md font-semibold mb-3 flex items-center text-primary">
                    <group.icon className="mr-2 h-5 w-5" /> {group.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                    {group.permissions.map((perm) => (
                      <FormField
                        key={perm.id}
                        control={form.control}
                        name={perm.id as keyof PermissionsFormValues}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              {perm.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  {permissionGroups.indexOf(group) < permissionGroups.length - 1 && <Separator className="my-6" />}
                </div>
              ))}
            </form>
          </Form>
        </div>
        <DialogFooter className="p-6 pt-4 border-t shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isProcessing}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="edit-permissions-form" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
