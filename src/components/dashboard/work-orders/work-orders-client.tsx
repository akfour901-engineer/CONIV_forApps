
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, ShoppingCart, Eye, Edit, Trash2, Copy, Search, Link as LinkIconOriginal, AlertTriangle, Settings2, UploadCloud, ArrowDownUp, Receipt, HardHat, Bot, Hammer, FileClock, Wrench, CreditCard, DownloadCloud, FileArchive, Loader2, UserCog, Clock, PieChart, Banknote } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { WorkOrder, Invoice, TeamPermissions, WorkOrderStatus } from '@/types';
import { WORK_ORDER_STATUS_OPTIONS } from '@/types';
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
import { useLoading } from '@/contexts/loading-context';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { PO_COMMIT_TO_EXPENSE_COST } from '@/lib/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ViewWorkOrderDocumentsModal from '@/components/work-orders/view-work-order-documents-modal';
import AwardProofModal from '@/components/purchase-orders/award-proof-modal';
import { WorkOrderSdAnalyzerModal } from './work-order-sd-analyzer-modal';
import { WorkOrderInvoiceStatusModal } from './work-order-invoice-status-modal';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  "in-progress": "bg-indigo-100 text-indigo-800 border-indigo-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  "on-hold": "bg-orange-100 text-orange-800 border-orange-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

interface WorkOrderCardProps {
  wo: WorkOrder;
  onDeleteWorkOrder: (woId: string, woNumber: string) => void;
  onStatusChange: (woId: string, woNumber: string, newStatus: WorkOrderStatus) => void;
  onOpenDocumentsModal: (wo: WorkOrder) => void;
  onOpenProofModal: (wo: WorkOrder) => void;
  onOpenSdAnalyzerModal: (wo: WorkOrder) => void;
  onOpenInvoiceStatusModal: (wo: WorkOrder) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  updatingStatusId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canCreateInvoice: boolean;
  canAddLabour: boolean;
  canAddDocument: boolean;
  canManagePOs: boolean;
  canManageTeam: boolean;
  canManageDpr: boolean;
  canManageSvr: boolean;
  canLogExpense: boolean;
  canRunRiskAssessment: boolean;
  canUseAsTemplate: boolean;
  canLogTime: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const WorkOrderCard = React.memo(({
  wo,
  onDeleteWorkOrder,
  onStatusChange,
  onOpenDocumentsModal,
  onOpenProofModal,
  onOpenSdAnalyzerModal,
  onOpenInvoiceStatusModal,
  isDeleting,
  currentDeletingId,
  updatingStatusId,
  canEdit,
  canDelete,
  canChangeStatus,
  canCreateInvoice,
  canAddLabour,
  canAddDocument,
  canManagePOs,
  canManageTeam,
  canManageDpr,
  canManageSvr,
  canLogExpense,
  canRunRiskAssessment,
  canUseAsTemplate,
  canLogTime,
  setGlobalIsLoading
}: WorkOrderCardProps) => {
  const isDeleteActionAllowed = ['draft', 'pending', 'cancelled'].includes(wo.status);
  
  return (
    <Card key={wo.id} className="shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg">{wo.workOrderNumber}</CardTitle>
          <div className="w-40">
            <Select value={wo.status} onValueChange={(newStatus) => onStatusChange(wo.id!, wo.workOrderNumber, newStatus as WorkOrderStatus)} disabled={!canChangeStatus || updatingStatusId === wo.id}>
              <SelectTrigger className="h-8 text-xs capitalize"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{WORK_ORDER_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <CardDescription className="text-sm truncate" title={wo.organizationName}>For: {wo.organizationName}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1 flex-grow">
        <p><span className="font-medium">Company:</span> {wo.companyName ?? 'N/A'}</p>
        <p><span className="font-medium">Date:</span> {formatDate(wo.startDate)}</p>
        <p className="font-semibold text-primary">Amount: {formatCurrency(wo.grandTotal)}</p>
      </CardContent>
      <CardFooter className="flex justify-end pt-3 border-t mt-auto">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                    Actions <Settings2 className="ml-2 h-4 w-4"/>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/work-orders/${wo.id}`}><span className="flex items-center w-full"><Eye className="mr-2 h-4 w-4"/>View Details</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canEdit} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/work-orders/${wo.id}/edit`}><span className="flex items-center w-full"><Edit className="mr-2 h-4 w-4"/>Edit</span></Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenDocumentsModal(wo)}><span className="flex items-center w-full"><FileArchive className="mr-2 h-4 w-4 text-blue-600" />View/Attach Docs</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenProofModal(wo)}><span className="flex items-center w-full"><UploadCloud className="mr-2 h-4 w-4 text-blue-600" />Attach Award Proof</span></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canUseAsTemplate} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/work-orders/new?templateWorkOrderId=${wo.id}`}><span className="flex items-center w-full"><Copy className="mr-2 h-4 w-4 text-purple-600" /> Use as Template</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild disabled={!canCreateInvoice || wo.status === 'cancelled' || wo.status === 'draft'} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/invoices/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><Receipt className="mr-2 h-4 w-4 text-green-600" /> Create Invoice</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canManagePOs} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/advance-tools/purchase-orders/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><ShoppingCart className="mr-2 h-4 w-4 text-pink-500"/>Create PO</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canLogExpense} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/expenses/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><CreditCard className="mr-2 h-4 w-4 text-red-500" />Log Expense</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild disabled={!canAddLabour} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/labour-register/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><HardHat className="mr-2 h-4 w-4 text-lime-600" /> Add Labour</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canLogTime} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/advance-tools/time-tracking?workOrderId=${wo.id}`}><span className="flex items-center w-full"><Clock className="mr-2 h-4 w-4 text-violet-600" /> Log Time</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canManageDpr} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/dpr/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><FileClock className="mr-2 h-4 w-4 text-cyan-600" /> Log DPR</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canManageSvr} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/svr/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><Wrench className="mr-2 h-4 w-4 text-blue-600" /> Log SVR</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canManageTeam} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/team/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><UserCog className="mr-2 h-4 w-4 text-fuchsia-500" /> Assign Team</span></Link></DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuLabel>Analysis</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={() => onOpenSdAnalyzerModal(wo)}><span className="flex items-center w-full"><PieChart className="mr-2 h-4 w-4 text-indigo-500"/>SD Analysis</span></DropdownMenuItem>
                 <DropdownMenuItem onClick={() => onOpenInvoiceStatusModal(wo)}><span className="flex items-center w-full"><Banknote className="mr-2 h-4 w-4 text-green-500"/>Invoice Status</span></DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canRunRiskAssessment} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/advance-tools/ai-risk-assessment?docId=${wo.id}&docType=workOrders`}><span className="flex items-center w-full"><Bot className="mr-2 h-4 w-4 text-rose-500"/> Assess Risk</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canDelete || !isDeleteActionAllowed} className="text-destructive focus:text-destructive focus:bg-destructive/10"><span className="flex items-center"><Trash2 className="mr-2 h-4 w-4" />Delete Work Order</span></DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete Work Order {wo.workOrderNumber}. This action may fail if it is linked to other records.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteWorkOrder(wo.id!, wo.workOrderNumber)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
});
WorkOrderCard.displayName = 'WorkOrderCard';

interface WorkOrdersClientPageProps {
  workOrders: WorkOrder[];
  allInvoices: Invoice[];
  isLoading: boolean;
  refetchData: () => void;
}

export default function WorkOrdersClientPage({ workOrders, allInvoices, isLoading, refetchData }: WorkOrdersClientPageProps) {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [selectedWOForDocuments, setSelectedWOForDocuments] = useState<WorkOrder | null>(null);
  
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [selectedWOForProof, setSelectedWOForProof] = useState<WorkOrder | null>(null);

  const [isSdAnalyzerModalOpen, setIsSdAnalyzerModalOpen] = useState(false);
  const [selectedWOForSdAnalysis, setSelectedWOForSdAnalysis] = useState<WorkOrder|null>(null);

  const [isInvoiceStatusModalOpen, setIsInvoiceStatusModalOpen] = useState(false);
  const [selectedWOForInvoiceStatus, setSelectedWOForInvoiceStatus] = useState<WorkOrder|null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof WorkOrder; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canManageInvoices = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateInvoices, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canManageWorkOrders = useMemo(() => isViewingOwnAccount || !!(currentTeamMemberPermissions?.canCreateWorkOrders && currentTeamMemberPermissions?.canEditWorkOrders && currentTeamMemberPermissions?.canDeleteWorkOrders), [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canCreateWorkOrders = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateWorkOrders, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canEditWorkOrders = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canEditWorkOrders, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canDeleteWorkOrders = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canDeleteWorkOrders, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canChangeWorkOrderStatus = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canChangeWorkOrderStatus, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canCreateInvoice = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateInvoices, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canAddLabour = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageLabourRegister, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canAddDocument = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDocuments, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canManagePOs = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreatePurchaseOrders, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canManageTeam = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageTeam, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canManageDpr = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDpr, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canManageSvr = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageSvr, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canLogExpense = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageExpenses, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canRunRiskAssessment = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiRiskAssessment, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canLogTime = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageTimeTracking || !!currentTeamMemberPermissions?.canRecordLabourAttendance, [isViewingOwnAccount, currentTeamMemberPermissions]);


  const handleOpenDocumentsModal = useCallback((wo: WorkOrder) => {
    setSelectedWOForDocuments(wo);
    setIsDocumentsModalOpen(true);
  }, []);
  
  const handleOpenProofModal = useCallback((wo: WorkOrder) => {
    setSelectedWOForProof(wo);
    setIsProofModalOpen(true);
  }, []);
  
  const handleOpenSdAnalyzerModal = useCallback((wo: WorkOrder) => {
    setSelectedWOForSdAnalysis(wo);
    setIsSdAnalyzerModalOpen(true);
  }, []);

  const handleOpenInvoiceStatusModal = useCallback((wo: WorkOrder) => {
    setSelectedWOForInvoiceStatus(wo);
    setIsInvoiceStatusModalOpen(true);
  }, []);

  const handleDeleteWorkOrder = useCallback(async (woId: string, woNumber: string) => {
    if (!canDeleteWorkOrders) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
    setIsDeleting(true); setCurrentDeletingId(woId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/work-orders/${woId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) { toast({ title: "Deletion Blocked", description: errorData.error, variant: "destructive", duration: 7000 }); return; }
        throw new Error(errorData.error || 'Failed to delete WO.');
      }
      toast({ title: "Success", description: `WO ${woNumber} deleted.` });
      refetchData();
    } catch (error: any) { toast({ title: "Error", description: `Could not delete WO: ${error.message}`, variant: "destructive" });
    } finally { setIsDeleting(false); setCurrentDeletingId(null); }
  }, [user, canDeleteWorkOrders, toast, refetchData]);

  const handleStatusChange = useCallback(async (woId: string, woNumber: string, newStatus: WorkOrderStatus) => {
    if (!user || !userProfile || !canChangeWorkOrderStatus || !appConfig) { toast({ title: "Permission Denied or Config Missing", variant: "destructive"}); return; }
    
    if (newStatus === 'completed') {
      const cost = appConfig?.actionCosts?.find(c => c.key === 'PO_COMMIT_TO_EXPENSE_COST')?.cost ?? PO_COMMIT_TO_EXPENSE_COST;
      const currentPoints = userProfile.resourcePoints ?? 0;
      if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
      }
    }

    setUpdatingStatusId(woId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/work-orders/${woId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || 'Failed to update status.');
        }
      } else {
        const result = await response.json();
        if(updateGlobalUserProfile && userProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
            updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() } });
        }
        refetchData();
        toast({ title: "Status Updated", description: `WO ${woNumber} status updated.` });
      }
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setUpdatingStatusId(null); }
  }, [user, userProfile, canChangeWorkOrderStatus, appConfig, toast, refetchData, updateGlobalUserProfile, dataOwnerId]);

  const handleSortChange = (value: string) => { if (value === 'none') { setSortConfig(null); } else { const [key, direction] = value.split('_') as [keyof WorkOrder, 'asc' | 'desc']; setSortConfig({ key, direction }); }};
  const sortedAndFilteredWOs = useMemo(() => {
    let filtered = workOrders.filter(wo => {
      const term = searchTerm.toLowerCase();
      return (
        wo.workOrderNumber.toLowerCase().includes(term) ||
        wo.organizationName.toLowerCase().includes(term) ||
        (wo.companyName && wo.companyName.toLowerCase().includes(term)) ||
        (wo.scopeOfWork && wo.scopeOfWork.toLowerCase().includes(term)) ||
        wo.status.toLowerCase().includes(term)
      );
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key]; const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1; if (bValue === null || bValue === undefined) return -1;
        if (sortConfig.key === 'startDate' || sortConfig.key === 'endDate' || sortConfig.key === 'createdAt') {
            return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') { return aValue.localeCompare(bValue as string) * (sortConfig.direction === 'asc' ? 1 : -1); }
        if (typeof aValue === 'number' && typeof bValue === 'number') { return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1); }
        return 0;
      });
    }
    return filtered;
  }, [workOrders, searchTerm, sortConfig]);
  
  const totalPages = Math.ceil(sortedAndFilteredWOs.length / itemsPerPage);
  const paginatedWOs = sortedAndFilteredWOs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!canManageWorkOrders && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage Work Orders.</p>
        <Button asChild onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <>
    <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
    <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Work Order List</CardTitle>
          <CardDescription>All created work orders.</CardDescription>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by #, Client, Company, Scope, Status..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
             <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'createdAt_desc'}>
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt_desc">Date: Newest</SelectItem>
                <SelectItem value="grandTotal_desc">Amount: High-Low</SelectItem>
                <SelectItem value="organizationName_asc">Client (A-Z)</SelectItem>
                <SelectItem value="endDate_asc">End Date: Soonest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
           <div className="md:hidden grid gap-4 sm:grid-cols-2">
              {paginatedWOs.length > 0 ? paginatedWOs.map((wo) => <WorkOrderCard key={wo.id} wo={wo} onDeleteWorkOrder={handleDeleteWorkOrder} onStatusChange={handleStatusChange} onOpenDocumentsModal={handleOpenDocumentsModal} onOpenProofModal={handleOpenProofModal} onOpenSdAnalyzerModal={handleOpenSdAnalyzerModal} onOpenInvoiceStatusModal={handleOpenInvoiceStatusModal} isDeleting={isDeleting} updatingStatusId={updatingStatusId} currentDeletingId={currentDeletingId} canEdit={canEditWorkOrders} canDelete={canDeleteWorkOrders} canChangeStatus={canChangeWorkOrderStatus} canCreateInvoice={canCreateInvoice} canAddLabour={canAddLabour} canAddDocument={canAddDocument} canManagePOs={canManagePOs} canManageTeam={canManageTeam} canManageDpr={canManageDpr} canManageSvr={canManageSvr} canLogExpense={canLogExpense} canRunRiskAssessment={canRunRiskAssessment} canUseAsTemplate={canCreateWorkOrders} canLogTime={canLogTime} setGlobalIsLoading={setGlobalIsLoading}/>) : <p className="text-muted-foreground text-center py-8 col-span-full">No WOs found.</p>}
            </div>
          <div className="hidden md:block">
            {paginatedWOs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[120px]">WO #</TableHead><TableHead>Client</TableHead><TableHead className="hidden sm:table-cell">Start Date</TableHead><TableHead className="hidden sm:table-cell">End Date</TableHead><TableHead className="w-[180px]">Status</TableHead><TableHead className="text-right w-[120px]">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {paginatedWOs.map((wo) => {
                      const isDeleteActionAllowed = ['draft', 'pending', 'cancelled'].includes(wo.status);
                      return (
                      <TableRow key={wo.id}><TableCell className="font-medium">{wo.workOrderNumber}</TableCell><TableCell className="break-words" title={wo.organizationName}>{wo.organizationName}</TableCell><TableCell className="hidden sm:table-cell">{formatDate(wo.startDate)}</TableCell><TableCell className="hidden sm:table-cell">{formatDate(wo.endDate)}</TableCell><TableCell>
                           <Select value={wo.status} onValueChange={(newStatus) => handleStatusChange(wo.id!, wo.workOrderNumber, newStatus as WorkOrderStatus)} disabled={!canChangeWorkOrderStatus || updatingStatusId === wo.id}><SelectTrigger className="h-9 text-xs capitalize"><SelectValue placeholder="Change Status" /></SelectTrigger><SelectContent>{WORK_ORDER_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g," ")}</SelectItem>)}</SelectContent></Select>
                            </TableCell><TableCell className="text-right">{formatCurrency(wo.grandTotal)}</TableCell><TableCell className="text-right"><div className="flex justify-end items-center flex-wrap gap-1">
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                          <Settings2 className="h-4 w-4" />
                                          <span className="sr-only">Actions</span>
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/work-orders/${wo.id}`}><span className="flex items-center w-full"><Eye className="mr-2 h-4 w-4"/>View Details</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canEditWorkOrders} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/work-orders/${wo.id}/edit`}><span className="flex items-center w-full"><Edit className="mr-2 h-4 w-4"/>Edit</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenDocumentsModal(wo)}><span className="flex items-center w-full"><FileArchive className="mr-2 h-4 w-4 text-blue-600" />View/Attach Docs</span></DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenProofModal(wo)}><span className="flex items-center w-full"><UploadCloud className="mr-2 h-4 w-4 text-blue-600" />Attach Award Proof</span></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canCreateWorkOrders} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/work-orders/new?templateWorkOrderId=${wo.id}`}><span className="flex items-center w-full"><Copy className="mr-2 h-4 w-4 text-purple-600" /> Use as Template</span></Link></DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild disabled={!canCreateInvoice || wo.status === 'cancelled' || wo.status === 'draft'} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/invoices/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><Receipt className="mr-2 h-4 w-4 text-green-600" /> Create Invoice</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canManagePOs} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/advance-tools/purchase-orders/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><ShoppingCart className="mr-2 h-4 w-4 text-pink-500"/>Create PO</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canLogExpense} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/expenses/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><CreditCard className="mr-2 h-4 w-4 text-red-500" />Log Expense</span></Link></DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild disabled={!canAddLabour} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/labour-register/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><HardHat className="mr-2 h-4 w-4 text-lime-600" /> Add Labour</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canLogTime} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/advance-tools/time-tracking?workOrderId=${wo.id}`}><span className="flex items-center w-full"><Clock className="mr-2 h-4 w-4 text-violet-600" /> Log Time</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canManageDpr} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/dpr/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><FileClock className="mr-2 h-4 w-4 text-cyan-600" /> Log DPR</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canManageSvr} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/svr/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><Wrench className="mr-2 h-4 w-4 text-blue-600" /> Log SVR</span></Link></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canManageTeam} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/team/new?workOrderId=${wo.id}`}><span className="flex items-center w-full"><UserCog className="mr-2 h-4 w-4 text-fuchsia-500" /> Assign Team</span></Link></DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>Analysis</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleOpenSdAnalyzerModal(wo)}><span className="flex items-center w-full"><PieChart className="mr-2 h-4 w-4 text-indigo-500"/>SD Analysis</span></DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenInvoiceStatusModal(wo)}><span className="flex items-center w-full"><Banknote className="mr-2 h-4 w-4 text-green-500"/>Invoice Status</span></DropdownMenuItem>
                                      <DropdownMenuItem asChild disabled={!canRunRiskAssessment} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/advance-tools/ai-risk-assessment?docId=${wo.id}&docType=workOrders`}><span className="flex items-center w-full"><Bot className="mr-2 h-4 w-4 text-rose-500"/> Assess Risk</span></Link></DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canDeleteWorkOrders || !isDeleteActionAllowed} className="text-destructive focus:text-destructive focus:bg-destructive/10"><span className="flex items-center"><Trash2 className="mr-2 h-4 w-4" />Delete Work Order</span></DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete Work Order {wo.workOrderNumber}. This action may fail if it is linked to other records.</AlertDialogDescription></AlertDialogHeader>
                                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteWorkOrder(wo.id!, wo.workOrderNumber)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                            </div></TableCell></TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : <p className="text-center py-12 text-muted-foreground">No work orders yet.</p>}
          </div>
        </CardContent>
        {sortedAndFilteredWOs.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-4"><DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={workOrders.length} filteredItemCount={sortedAndFilteredWOs.length}/></CardFooter>
        )}
      </Card>
      
      <ViewWorkOrderDocumentsModal
        isOpen={isDocumentsModalOpen}
        onOpenChange={setIsDocumentsModalOpen}
        workOrder={selectedWOForDocuments}
      />
      
      {selectedWOForProof && (
        <AwardProofModal
          isOpen={isProofModalOpen}
          onOpenChange={setIsProofModalOpen}
          document={selectedWOForProof}
          onDocumentUpdated={refetchData}
          documentType='work-order'
        />
      )}
       <WorkOrderSdAnalyzerModal
        isOpen={isSdAnalyzerModalOpen}
        onOpenChange={setIsSdAnalyzerModalOpen}
        workOrder={selectedWOForSdAnalysis}
      />
      <WorkOrderInvoiceStatusModal
        isOpen={isInvoiceStatusModalOpen}
        onOpenChange={setIsInvoiceStatusModalOpen}
        workOrder={selectedWOForInvoiceStatus}
        invoices={allInvoices.filter(inv => inv.workOrderId === selectedWOForInvoiceStatus?.id)}
      />
    </>
  );
}
