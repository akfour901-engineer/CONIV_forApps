
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, FileClock, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, Loader2, Printer } from "lucide-react";
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import type { DailyProgressReport, WorkOrder } from '@/types';
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
import { format, parseISO } from 'date-fns';
import DprLoadingSkeleton from '@/app/dashboard/dpr/loading';
import { useLoading } from '@/contexts/loading-context';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import DprPrintModal from '@/components/dpr/dpr-print-modal';

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy'); }
  catch (e) {
    try { return format(new Date(dateString), 'dd MMM yyyy'); }
    catch (parseErr) { return dateString; }
  }
};

export default function DprListPage() {
  const { user, loading: authLoading, dataOwnerId, currentTeamMemberPermissions, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<DailyProgressReport[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterWorkOrder, setFilterWorkOrder] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedDprForPrint, setSelectedDprForPrint] = useState<DailyProgressReport | null>(null);

  const canManageDpr = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDpr;

  const fetchDprData = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageDpr) { 
      if(!authLoading && !canManageDpr) toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false); return; 
    }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const params = new URLSearchParams({ dataOwnerId });
      if (filterWorkOrder !== 'all') params.append('workOrderId', filterWorkOrder);
      
      const [woResponse, dprResponse] = await Promise.all([
         fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
         fetch(`/api/dpr?${params.toString()}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      ]);
      
      if (!woResponse.ok) throw new Error('Failed to fetch work orders');
      const woData: WorkOrder[] = await woResponse.json();
      setWorkOrders([{ value: 'all', label: 'All Work Orders' }, ...woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` }))]);
      
      if (!dprResponse.ok) throw new Error((await dprResponse.json()).error || 'Failed to fetch DPRs.');
      setReports(await dprResponse.json());

    } catch (error: any) {
      toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, canManageDpr, filterWorkOrder, authLoading, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchDprData();
    }
  }, [authLoading, fetchDprData]);
  
  const handleDelete = async (dprId: string) => {
    if (!canManageDpr) return;
    setCurrentDeletingId(dprId);
    setIsDeleting(true);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/dpr/${dprId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error('Failed to delete DPR.');
      toast({ title: "Success", description: "DPR deleted." });
      fetchDprData(); // Re-fetch
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCurrentDeletingId(null);
      setIsDeleting(false);
    }
  };
  
  const handleOpenPrintModal = (report: DailyProgressReport) => {
    setSelectedDprForPrint(report);
    setIsPrintModalOpen(true);
  };

  const sortedAndFilteredReports = useMemo(() => {
    return reports.filter(r => 
        r.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.todaysCompletion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reportDate.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [reports, searchTerm]);

  const totalPages = Math.ceil(sortedAndFilteredReports.length / itemsPerPage);
  const paginatedReports = sortedAndFilteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) { return <DprLoadingSkeleton />; }

  if (!canManageDpr && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage DPRs.</p>
        <Button asChild onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><FileClock className="mr-3 h-7 w-7 text-primary" /> Daily Progress Reports</h1><p className="text-muted-foreground">Log and review daily progress for your work orders.</p></div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button asChild className="w-full" variant="outline" onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/dpr-summary">
              <Printer className="mr-2 h-4 w-4" /> Print Summary
            </Link>
          </Button>
          <Button asChild className="w-full" disabled={!canManageDpr} onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/dpr/new">
              <PlusCircle className="mr-2 h-5 w-5" /> Log New DPR
            </Link>
          </Button>
        </div>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>DPR Log</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
            <Combobox options={workOrders} value={filterWorkOrder} onChange={setFilterWorkOrder} placeholder="Filter by Work Order..." className="w-full md:w-[250px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Date</TableHead>
                  <TableHead>Work Order #</TableHead>
                  <TableHead>Completion Summary</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReports.length > 0 ? (
                  paginatedReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium whitespace-nowrap">{formatDate(report.reportDate)}</TableCell>
                      <TableCell>{report.workOrderNumber}</TableCell>
                      <TableCell className="max-w-sm truncate" title={report.todaysCompletion}>{report.todaysCompletion}</TableCell>
                      <TableCell className="text-right">{report.workRating}/10</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPrintModal(report)} title="Print DPR"><Printer className="h-4 w-4"/></Button>
                        <Button asChild variant="ghost" size="sm" onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/dpr/${report.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={isDeleting && currentDeletingId === report.id}>
                              {isDeleting && currentDeletingId === report.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the DPR for {report.workOrderNumber} on {formatDate(report.reportDate)}.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(report.id!)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">No reports found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {sortedAndFilteredReports.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-2">
            <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={reports.length} filteredItemCount={sortedAndFilteredReports.length}/>
          </CardFooter>
        )}
      </Card>
    </div>
    <DprPrintModal
      isOpen={isPrintModalOpen}
      onOpenChange={setIsPrintModalOpen}
      report={selectedDprForPrint}
    />
    </>
  );
}
