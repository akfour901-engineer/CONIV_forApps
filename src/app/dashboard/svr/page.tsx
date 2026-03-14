

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, FileClock, Search, ArrowDownUp, AlertTriangle, Edit, Trash2, Eye, Loader2, Printer, Wrench } from "lucide-react";
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { DailyProgressReport, WorkOrder, ServiceVisitReport } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useLoading } from '@/contexts/loading-context';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import SvrLoadingSkeleton from './loading';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
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
import { useRouter } from 'next/navigation';
import SvrPrintModal  from '@/components/svr/svr-print-modal';

export default function SvrListPage() {
  const { user, loading: authLoading, dataOwnerId, isViewingOwnAccount, currentTeamMemberPermissions } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [reports, setReports] = useState<ServiceVisitReport[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedSvrForPrint, setSelectedSvrForPrint] = useState<ServiceVisitReport | null>(null);


  const [searchTerm, setSearchTerm] = useState('');
  const [filterWorkOrder, setFilterWorkOrder] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceVisitReport; direction: 'asc' | 'desc' } | null>({ key: 'visitDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const canManageSvr = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageSvr;

  const fetchSvrData = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageSvr) { 
      if(!authLoading && !canManageSvr) toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false); return; 
    }

    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const params = new URLSearchParams({ dataOwnerId });
      if (filterWorkOrder !== 'all') params.append('workOrderId', filterWorkOrder);
      
      const [woResponse, svrResponse] = await Promise.all([
         fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
         fetch(`/api/svr?${params.toString()}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      ]);
      
      if (!woResponse.ok) throw new Error('Failed to fetch work orders');
      const woData: WorkOrder[] = await woResponse.json();
      setWorkOrders([{ value: 'all', label: 'All Work Orders' }, ...woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` }))]);
      
      if (!svrResponse.ok) throw new Error((await svrResponse.json()).error || 'Failed to fetch SVRs.');
      setReports(await svrResponse.json());

    } catch (error: any) {
      toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, canManageSvr, filterWorkOrder, authLoading, toast]);

  useEffect(() => {
    if (!authLoading) fetchSvrData();
  }, [authLoading, fetchSvrData]);
  
  const handleDeleteSvr = async (svrId: string) => {
    if (!user) return;
    setCurrentDeletingId(svrId);
    setIsDeleting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/svr/${svrId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || "Failed to delete SVR.");
      }
      toast({ title: "Success", description: "SVR deleted." });
      fetchSvrData(); // Re-fetch data
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setCurrentDeletingId(null);
    }
  };


  const sortedAndFilteredReports = useMemo(() => {
    let filtered = reports.filter(r => {
      const term = searchTerm.toLowerCase();
      return r.workOrderNumber.toLowerCase().includes(term) || r.purposeOfVisit.toLowerCase().includes(term) || r.actionsTaken.toLowerCase().includes(term);
    });
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1; if (bValue === null || bValue === undefined) return -1;
        if (sortConfig.key === 'visitDate') return (new Date(bValue as string).getTime() - new Date(aValue as string).getTime()) * (sortConfig.direction === 'asc' ? -1 : 1);
        if (typeof aValue === 'number' && typeof bValue === 'number') return (bValue - aValue) * (sortConfig.direction === 'asc' ? -1 : 1);
        return 0;
      });
    }
    return filtered;
  }, [reports, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredReports.length / itemsPerPage);
  const paginatedReports = sortedAndFilteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    if (value === 'none') setSortConfig(null);
    else { const [key, direction] = value.split('_') as [keyof ServiceVisitReport, 'asc' | 'desc']; setSortConfig({ key, direction }); }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'dd MMM yyyy');
    } catch (e) {
        return 'Invalid Date';
    }
  };
  
  const handleOpenPrintModal = useCallback((report: ServiceVisitReport) => {
    setSelectedSvrForPrint(report);
    setIsPrintModalOpen(true);
  }, []);

  if (isLoading || authLoading) return <SvrLoadingSkeleton />;
  if (!canManageSvr) return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="w-16 h-16 text-destructive mb-4" /><h2 className="text-xl font-semibold">Permission Denied</h2><p className="text-muted-foreground">You do not have permission to manage SVRs.</p><Button asChild className="mt-6"><Link href="/dashboard">Back to Dashboard</Link></Button></div> );

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><Wrench className="mr-3 h-7 w-7 text-primary" />Service Visit Reports (SVR)</h1><p className="text-muted-foreground">Log and review service visits for your work orders.</p></div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button asChild className="w-full sm:w-auto" disabled={!canManageSvr} onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/svr/new"><PlusCircle className="mr-2 h-5 w-5" /> Log New SVR</Link></Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>SVR Log</CardTitle>
          <CardDescription>A list of all submitted service visit reports.</CardDescription>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search reports..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
            <Combobox options={workOrders} value={filterWorkOrder} onChange={(val) => setFilterWorkOrder(val)} placeholder="Filter by Work Order..." searchPlaceholder="Search WOs..." disabled={isLoading}/>
            <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'visitDate_desc'}>
              <SelectTrigger className="w-full md:w-[220px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent><SelectItem value="visitDate_desc">Newest First</SelectItem><SelectItem value="visitDate_asc">Oldest First</SelectItem><SelectItem value="visitRating_desc">Rating</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedReports.length === 0 ? (<div className="text-center py-12"><Wrench className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-4 text-lg font-medium">{searchTerm ? "No SVRs Match Search" : "No SVRs Recorded Yet"}</p></div>) : (
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Visit Date</TableHead><TableHead>Work Order #</TableHead><TableHead>Purpose of Visit</TableHead><TableHead className="text-right">Rating</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginatedReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium whitespace-nowrap">{formatDate(report.visitDate)}</TableCell>
                      <TableCell>{report.workOrderNumber}</TableCell>
                      <TableCell className="max-w-sm truncate" title={report.purposeOfVisit}>{report.purposeOfVisit}</TableCell>
                      <TableCell className="text-right font-semibold">{report.visitRating}/10</TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenPrintModal(report)} title="Print SVR"><Printer className="h-4 w-4"/></Button>
                          <Button variant="ghost" size="sm" asChild onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/svr/${report.id}?edit=true`}><Edit className="h-4 w-4" /></Link></Button>
                          <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/90" disabled={isDeleting && currentDeletingId === report.id}>{isDeleting && currentDeletingId === report.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the SVR for {report.workOrderNumber} on {formatDate(report.visitDate)}.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSvr(report.id!)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {sortedAndFilteredReports.length > 0 && (<CardFooter className="border-t pt-2"><DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={reports.length} filteredItemCount={sortedAndFilteredReports.length}/></CardFooter>)}
      </Card>
    </div>
    <SvrPrintModal
        isOpen={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        report={selectedSvrForPrint}
    />
    </>
  );
}

    
