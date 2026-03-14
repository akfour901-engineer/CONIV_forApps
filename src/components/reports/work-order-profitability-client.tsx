
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, ArrowUpRight, ArrowDownRight, AlertTriangle, Search, ArrowDownUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import FinancialSummaryLoadingSkeleton from '@/app/dashboard/financial-summary/loading';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import type { WorkOrderProfitabilityItem } from '@/app/api/reports/work-order-profitability/route';
import { Badge } from '@/components/ui/badge';
import { WORK_ORDER_STATUS_OPTIONS } from '@/types';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  "in-progress": "bg-indigo-100 text-indigo-800 border-indigo-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  "on-hold": "bg-orange-100 text-orange-800 border-orange-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

export default function WorkOrderProfitabilityClientPage() {
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<WorkOrderProfitabilityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof WorkOrderProfitabilityItem; direction: 'asc' | 'desc' } | null>({ key: 'profitLoss', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const canView = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewFinancialSummaries, [isViewingOwnAccount, currentTeamMemberPermissions]);

  const fetchData = useCallback(async () => {
    if (!user || !dataOwnerId || !canView) {
      setIsLoading(false);
      if (!authLoading && !canView) {
        toast({ title: "Permission Denied", description: "You cannot view this page.", variant: "destructive" });
      }
      return;
    }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/reports/work-order-profitability?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch analysis data.');
      setAnalysisData(await response.json());
    } catch (error: any) {
      toast({ title: "Error Loading Data", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, canView, toast, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, fetchData]);

  const ProfitLossIndicator = ({ value }: { value: number }) => {
    const isProfit = value >= 0;
    const isLoss = value < 0;
    return (
      <div className={cn("flex items-center justify-end font-semibold", isProfit && "text-green-600", isLoss && "text-destructive")}>
        {isProfit && <ArrowUpRight className="mr-1 h-4 w-4 shrink-0" />}
        {isLoss && <ArrowDownRight className="mr-1 h-4 w-4 shrink-0" />}
        <span className="truncate">{formatCurrency(value)}</span>
      </div>
    );
  };
  
  const sortedAndFilteredData = useMemo(() => {
    let filtered = analysisData
      .filter(item => statusFilter === 'all' || item.status === statusFilter)
      .filter(item => 
        item.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [analysisData, searchTerm, statusFilter, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / itemsPerPage);
  const paginatedData = sortedAndFilteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('_') as [keyof WorkOrderProfitabilityItem, 'asc' | 'desc'];
    setSortConfig({ key, direction });
  };


  if (isLoading || authLoading) return <FinancialSummaryLoadingSkeleton />;
  if (!canView) { return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="w-16 h-16 text-destructive mb-4" /><h2 className="text-xl font-semibold">Permission Denied</h2><p className="text-muted-foreground">You do not have permission to view this page.</p><Button asChild className="mt-6"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link></Button></div> ); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center">
          <TrendingUp className="mr-3 h-7 w-7 text-primary" /> Work Order Profitability Report
        </h1>
        <p className="text-muted-foreground">Analyze revenue, costs, and profitability for each work order.</p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Analysis per Work Order</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search by WO# or Client..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
             <Select onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }} defaultValue={statusFilter}>
                <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Statuses</SelectItem>{WORK_ORDER_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/-/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'profitLoss_asc'}>
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent><SelectItem value="profitLoss_asc">Least Profitable</SelectItem><SelectItem value="profitLoss_desc">Most Profitable</SelectItem><SelectItem value="projectValue_desc">Project Value</SelectItem><SelectItem value="workOrderNumber_asc">WO # (A-Z)</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Project Value</TableHead>
                  <TableHead className="text-right">Revenue (Paid)</TableHead>
                  <TableHead className="text-right">Total Costs</TableHead>
                  <TableHead className="text-right">Profit / Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? paginatedData.map(item => (
                  <TableRow key={item.workOrderId}>
                    <TableCell className="font-medium">{item.workOrderNumber}</TableCell>
                    <TableCell>{item.organizationName}</TableCell>
                    <TableCell><Badge variant="outline" className={`capitalize ${statusColors[item.status] || ''}`}>{item.status.replace('-', ' ')}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(item.projectValue)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(item.totalRevenue)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(item.totalCost)}</TableCell>
                    <TableCell className="text-right"><ProfitLossIndicator value={item.profitLoss} /></TableCell>
                  </TableRow>
                )) : (<TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No work orders with associated financials found.</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {sortedAndFilteredData.length > 0 && (<CardFooter className="border-t pt-2"><DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={analysisData.length} filteredItemCount={sortedAndFilteredData.length} /></CardFooter>)}
      </Card>
    </div>
  );
}
