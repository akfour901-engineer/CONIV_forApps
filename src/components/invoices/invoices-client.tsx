

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Receipt, Eye, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, Loader2, Copy, FileText, Download, Printer, Settings2, ShoppingCart, CreditCard, Link as LinkIconOriginal } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { Invoice, InvoiceStatus } from '@/types';
import { INVOICE_STATUS_OPTIONS } from '@/types';
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
import InvoicesLoading from '@/app/dashboard/invoices/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import InvoicePrintModal from './invoice-print-modal';
import InvoicePaymentProofModal from './invoice-payment-proof-modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  sent: "bg-blue-100 text-blue-800 border-blue-300",
  paid: "bg-green-100 text-green-800 border-green-300",
  unpaid: "bg-yellow-100 text-yellow-800 border-yellow-300",
  overdue: "bg-red-100 text-red-800 border-red-300",
  'partially-paid': "bg-purple-100 text-purple-800 border-purple-300",
  cancelled: "bg-gray-500 text-white",
};

interface InvoiceCardProps {
    invoice: Invoice;
    onDeleteInvoice: (invoiceId: string, invoiceNumber: string) => void;
    onStatusChange: (invoiceId: string, invoiceNumber: string, newStatus: InvoiceStatus) => void;
    handleOpenPrintModal: (invoice: Invoice) => void;
    handleOpenProofModal: (invoice: Invoice) => void;
    isDeleting: boolean;
    updatingStatusId: string | null;
    currentProcessingId: string | null;
    canManage: boolean;
    setGlobalIsLoading: (loading: boolean) => void;
}

const InvoiceCard = React.memo(({ invoice, onDeleteInvoice, onStatusChange, handleOpenPrintModal, handleOpenProofModal, isDeleting, updatingStatusId, currentProcessingId, canManage, setGlobalIsLoading }: InvoiceCardProps) => {
    const isThisBeingProcessed = isDeleting && currentProcessingId === invoice.id || updatingStatusId === invoice.id;
    return (
        <Card key={invoice.id} className="shadow-sm">
        <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-md">{invoice.invoiceNumber}</CardTitle>
            <Select value={invoice.status} onValueChange={(newStatus) => onStatusChange(invoice.id!, invoice.invoiceNumber, newStatus as InvoiceStatus)} disabled={!canManage || isThisBeingProcessed}>
                <SelectTrigger className="h-8 text-xs capitalize w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>{INVOICE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace("-"," ")}</SelectItem>)}</SelectContent>
            </Select>
            </div>
            <CardDescription className="text-xs truncate" title={invoice.organizationName}>To: {invoice.organizationName}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-0.5 pt-1 pb-2 flex-grow">
            <p><span className="font-medium">Date:</span> {formatDate(invoice.date)}</p>
            <p className="font-semibold text-primary">Amount: {formatCurrency(invoice.grandTotal)}</p>
            <p className="font-semibold text-destructive">Due: {formatCurrency(invoice.balanceDue)}</p>
        </CardContent>
        <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                        Actions <Settings2 className="ml-2 h-4 w-4"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild disabled={!canManage} onClick={() => setGlobalIsLoading(true)}>
                        <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4"/>Edit
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenPrintModal(invoice)}>
                       <Printer className="mr-2 h-4 w-4"/> Print/Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenProofModal(invoice)}>
                        <FileText className="mr-2 h-4 w-4"/>Attach Proof
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canManage} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" />Delete Invoice
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete invoice {invoice.invoiceNumber}.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDeleteInvoice(invoice.id!, invoice.invoiceNumber)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DropdownMenuContent>
            </DropdownMenu>
        </CardFooter>
        </Card>
    );
});
InvoiceCard.displayName = 'InvoiceCard';


export default function InvoicesClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Invoice; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [selectedInvoiceForProof, setSelectedInvoiceForProof] = useState<Invoice | null>(null);

  const canManageInvoices = useMemo(() => isViewingOwnAccount || (!!currentTeamMemberPermissions?.canEditInvoices && !!currentTeamMemberPermissions?.canDeleteInvoices), [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canCreateInvoices = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateInvoices, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canChangeStatus = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canChangeInvoiceStatus, [isViewingOwnAccount, currentTeamMemberPermissions]);

  const fetchInvoices = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/invoices?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch invoices.');
      setInvoices(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load invoices: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchInvoices();
    }
  }, [authLoading, dataOwnerId, fetchInvoices]);
  
  const handleDeleteInvoice = useCallback(async (invoiceId: string, invoiceNumber: string) => {
    if (!canManageInvoices) return;
    setIsDeleting(true); setCurrentDeletingId(invoiceId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete invoice.');
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      toast({ title: "Success", description: `Invoice ${invoiceNumber} deleted.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete invoice: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  }, [user, canManageInvoices, toast]);
  
  const handleStatusChange = useCallback(async (invoiceId: string, invoiceNumber: string, newStatus: InvoiceStatus) => {
    if (!canChangeStatus) return;
    setUpdatingStatusId(invoiceId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update status.');
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus } : inv));
      toast({ title: "Status Updated", description: `Invoice ${invoiceNumber} status updated.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatusId(null);
    }
  }, [user, canChangeStatus, toast]);

  const handleOpenPrintModal = (invoice: Invoice) => {
    setSelectedInvoiceForPrint(invoice);
    setIsPrintModalOpen(true);
  };

  const handleOpenProofModal = (invoice: Invoice) => {
    setSelectedInvoiceForProof(invoice);
    setIsProofModalOpen(true);
  };

  const sortedAndFilteredInvoices = useMemo(() => {
    let filtered = invoices
      .filter(inv => statusFilter === 'all' || inv.status === statusFilter)
      .filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inv.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.companyName && inv.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    if (sortConfig) {
      // Sort logic here
    }
    return filtered;
  }, [invoices, searchTerm, sortConfig, statusFilter]);

  const totalPages = Math.ceil(sortedAndFilteredInvoices.length / itemsPerPage);
  const paginatedInvoices = sortedAndFilteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) return <InvoicesLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><Receipt className="mr-3 h-7 w-7 text-primary" />Invoices</h1><p className="text-muted-foreground">Manage and track all your client invoices.</p></div>
        <Button asChild disabled={!canCreateInvoices} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/invoices/new"><PlusCircle className="mr-2 h-5 w-5" /> Create New Invoice</Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Invoices</CardTitle>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by number, client, company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <Select onValueChange={setStatusFilter} defaultValue="all">
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {INVOICE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('-',' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="md:hidden grid gap-4 sm:grid-cols-2">
            {paginatedInvoices.map(inv => <InvoiceCard key={inv.id} invoice={inv} onDeleteInvoice={handleDeleteInvoice} onStatusChange={handleStatusChange} handleOpenPrintModal={handleOpenPrintModal} handleOpenProofModal={handleOpenProofModal} isDeleting={isDeleting} updatingStatusId={updatingStatusId} currentProcessingId={currentDeletingId} canManage={canManageInvoices} setGlobalIsLoading={setGlobalIsLoading} />)}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInvoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell><TableCell>{inv.organizationName}</TableCell><TableCell>{formatDate(inv.date)}</TableCell>
                    <TableCell><Badge variant="outline" className={`capitalize ${statusColors[inv.status] || ''}`}>{inv.status.replace('-',' ')}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.grandTotal)}</TableCell><TableCell className="text-right font-bold text-destructive">{formatCurrency(inv.balanceDue)}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <Settings2 className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                 <DropdownMenuItem asChild disabled={!canManageInvoices} onClick={() => setGlobalIsLoading(true)}>
                                    <Link href={`/dashboard/invoices/${inv.id}/edit`}>
                                        <Edit className="mr-2 h-4 w-4"/>Edit
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenPrintModal(inv)}>
                                <Printer className="mr-2 h-4 w-4"/> Print/Download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenProofModal(inv)}>
                                    <FileText className="mr-2 h-4 w-4"/>Attach Proof
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canManageInvoices || (isDeleting && currentDeletingId === inv.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <Trash2 className="mr-2 h-4 w-4" />Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete invoice {inv.invoiceNumber}.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteInvoice(inv.id!, inv.invoiceNumber)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {sortedAndFilteredInvoices.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-4">
            <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => setItemsPerPage(Number(v))} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={invoices.length} filteredItemCount={sortedAndFilteredInvoices.length}/>
          </CardFooter>
        )}
      </Card>
      <InvoicePrintModal
        isOpen={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        invoice={selectedInvoiceForPrint}
      />
      <InvoicePaymentProofModal
        isOpen={isProofModalOpen}
        onOpenChange={setIsProofModalOpen}
        invoice={selectedInvoiceForProof}
        onInvoiceUpdated={fetchInvoices}
      />
    </div>
  );
}

