
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, FileText, Eye, Edit, Trash2, Copy, Search, Link as LinkIcon, AlertTriangle, Settings2, Download, Printer, Bot } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { Estimate, EstimateStatus } from '@/types';
import { ESTIMATE_STATUS_OPTIONS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EstimatesLoading from '@/app/dashboard/estimates/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EstimatePrintModal from './estimate-print-modal';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  submitted: "bg-blue-100 text-blue-800 border-blue-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-orange-100 text-orange-800 border-orange-300",
};

interface EstimateCardProps {
  estimate: Estimate;
  onDeleteEstimate: (estimateId: string, estimateNumber: string) => void;
  onStatusChange: (estimateId: string, estimateNumber: string, newStatus: EstimateStatus) => void;
  onOpenPrintModal: (estimate: Estimate) => void;
  isDeleting: boolean;
  updatingStatusId: string | null;
  currentDeletingId: string | null;
  canManage: boolean;
  canChangeStatus: boolean;
  canUseAsTemplate: boolean;
  canConvertToWO: boolean;
  canRunRiskAssessment: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const EstimateCard = React.memo(({
    estimate,
    onDeleteEstimate,
    onStatusChange,
    onOpenPrintModal,
    isDeleting,
    updatingStatusId,
    currentDeletingId,
    canManage,
    canChangeStatus,
    canUseAsTemplate,
    canConvertToWO,
    canRunRiskAssessment,
    setGlobalIsLoading
  }: EstimateCardProps) => {

    const isActionInProgress = isDeleting && currentDeletingId === estimate.id;
    const isThisBeingUpdated = updatingStatusId === estimate.id;

  return (
    <Card key={estimate.id} className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-md">{estimate.estimateNumber}</CardTitle>
          <Select value={estimate.status} onValueChange={(newStatus) => onStatusChange(estimate.id!, estimate.estimateNumber, newStatus as EstimateStatus)} disabled={!canChangeStatus || isThisBeingUpdated}>
            <SelectTrigger className="h-8 text-xs capitalize w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>{ESTIMATE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <CardDescription className="text-xs truncate" title={estimate.organizationName}>To: {estimate.organizationName}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-0.5 pt-1 pb-2">
        <p><span className="font-medium">Date:</span> {formatDate(estimate.date)}</p>
        <p className="font-semibold text-primary">Amount: {formatCurrency(estimate.grandTotal)}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Actions <Settings2 className="ml-2 h-4 w-4"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/estimates/${estimate.id}/edit`}><Edit className="mr-2 h-4 w-4"/>Edit / View Details</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenPrintModal(estimate)}><Printer className="mr-2 h-4 w-4"/>Print / Download</DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canUseAsTemplate} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/estimates/new?templateEstimateId=${estimate.id}`}><Copy className="mr-2 h-4 w-4 text-purple-600" /> Use as Template</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild disabled={!canConvertToWO || estimate.status !== 'approved'} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/work-orders/new?templateEstimateId=${estimate.id}`}><FileText className="mr-2 h-4 w-4 text-green-600" />Convert to WO</Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canRunRiskAssessment} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/advance-tools/ai-risk-assessment?docId=${estimate.id}&docType=estimate`}><Bot className="mr-2 h-4 w-4 text-rose-500"/>Assess Risk</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canManage} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete estimate {estimate.estimateNumber}.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteEstimate(estimate.id!, estimate.estimateNumber)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
});
EstimateCard.displayName = 'EstimateCard';

export default function EstimatesClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedEstimateForPrint, setSelectedEstimateForPrint] = useState<Estimate | null>(null);

  const canCreate = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateEstimates;
  const canEdit = isViewingOwnAccount || !!currentTeamMemberPermissions?.canEditEstimates;
  const canDelete = isViewingOwnAccount || !!currentTeamMemberPermissions?.canDeleteEstimates;
  const canChangeStatus = isViewingOwnAccount || !!currentTeamMemberPermissions?.canChangeEstimateStatus;
  const canUseAsTemplate = canCreate;
  const canConvertToWO = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateWorkOrders;
  const canRunRiskAssessment = isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiRiskAssessment;

  const fetchEstimates = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/estimates?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch estimates.');
      }
      const data: { estimates: Estimate[], total: number } = await response.json();
      setEstimates(data.estimates);
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load estimates: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchEstimates();
    }
  }, [authLoading, dataOwnerId, fetchEstimates]);

  const handleDeleteEstimate = useCallback(async (estimateId: string, estimateNumber: string) => {
    if (!canDelete) return;
    setIsDeleting(true); setCurrentDeletingId(estimateId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/estimates/${estimateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to delete estimate.');
      }
      setEstimates(prev => prev.filter(est => est.id !== estimateId));
      toast({ title: "Success", description: `Estimate ${estimateNumber} deleted.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete estimate: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  }, [user, canDelete, toast]);

  const handleStatusChange = useCallback(async (estimateId: string, estimateNumber: string, newStatus: EstimateStatus) => {
    if (!canChangeStatus) return;
    setUpdatingStatusId(estimateId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/estimates/${estimateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to update status.');
      }
      toast({ title: "Status Updated", description: `Estimate ${estimateNumber} moved to ${newStatus}.` });
      fetchEstimates();
    } catch (error: any) {
      toast({ title: "Error", description: `Could not update status: ${error.message}`, variant: "destructive" });
    } finally {
      setUpdatingStatusId(null);
    }
  }, [user, canChangeStatus, toast, fetchEstimates]);
  
  const handleOpenPrintModal = (estimate: Estimate) => {
    setSelectedEstimateForPrint(estimate);
    setIsPrintModalOpen(true);
  };

  if (isLoading || authLoading) return <EstimatesLoading />;
  
  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <FileText className="mr-3 h-7 w-7 text-primary" /> Estimates
            </h1>
            <p className="text-muted-foreground">
              Create, manage, and track all your project proposals and cost estimates.
            </p>
          </div>
          <Button asChild disabled={!canCreate} onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/estimates/new">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Estimate
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Estimates</CardTitle>
            <CardDescription>A list of all your created estimates.</CardDescription>
          </CardHeader>
          <CardContent>
            {estimates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No Estimates Yet</p>
                <p className="text-sm text-muted-foreground">Get started by creating your first estimate.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-1 lg:grid-cols-2">
                {estimates.map(est => (
                  <EstimateCard
                    key={est.id}
                    estimate={est}
                    onDeleteEstimate={handleDeleteEstimate}
                    onStatusChange={handleStatusChange}
                    onOpenPrintModal={handleOpenPrintModal}
                    isDeleting={isDeleting}
                    updatingStatusId={updatingStatusId}
                    currentDeletingId={currentDeletingId}
                    canManage={canEdit && canDelete}
                    canChangeStatus={canChangeStatus}
                    canUseAsTemplate={canUseAsTemplate}
                    canConvertToWO={canConvertToWO}
                    canRunRiskAssessment={canRunRiskAssessment}
                    setGlobalIsLoading={setGlobalIsLoading}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <EstimatePrintModal
        isOpen={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        estimate={selectedEstimateForPrint}
      />
    </>
  );
}
