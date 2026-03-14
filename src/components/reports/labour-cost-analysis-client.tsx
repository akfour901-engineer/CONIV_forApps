
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, ArrowUpRight, ArrowDownRight, AlertTriangle, Search, ArrowDownUp, HardHat } from "lucide-react";
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

interface LabourCostAnalysisItem {
  workOrderId: string;
  workOrderNumber: string;
  organizationName: string;
  projectBudget: number;
  actualLabourCost: number;
  variance: number;
}

export default function LabourCostAnalysisClientPage() {
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<LabourCostAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof LabourCostAnalysisItem; direction: 'asc' | 'desc' } | null>({ key: 'variance', direction: 'asc' });
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
      const response = await fetch(`/api/reports/labour-cost-analysis?dataOwnerId=${dataOwnerId}`, {
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

  const VarianceIndicator = ({ value }: { value: number }) => {
    const isOverBudget = value < 0;
    const isUnderBudget = value > 0;
    return (
      <div className={cn("flex items-center justify-end font-semibold", isUnderBudget && "text-green-600", isOverBudget && "text-destructive")}>
        {isUnderBudget && <ArrowDownRight className="mr-1 h-4 w-4 shrink-0" />}
        {isOverBudget && <ArrowUpRight className="mr-1 h-4 w-4 shrink-0" />}
        <span className="truncate">{formatCurrency(Math.abs(value))}</span>
      </div>
    );
  };

  const sortedAndFilteredData = useMemo(() => {
    let filtered = analysisData.filter(item => 
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
  }, [analysisData, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / itemsPerPage);
  const paginatedData = sortedAndFilteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('_') as [keyof LabourCostAnalysisItem, 'asc' | 'desc'];
    setSortConfig({ key, direction });
  };


  if (isLoading || authLoading) return <FinancialSummaryLoadingSkeleton />;
  if (!canView) { return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="w-16 h-16 text-destructive mb-4" /><h2 className="text-xl font-semibold">Permission Denied</h2><p className="text-muted-foreground">You do not have permission to view this page.</p><Button asChild className="mt-6"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link></Button></div> ); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center">
          <HardHat className="mr-3 h-7 w-7 text-primary" /> Labour Cost vs. Budget Analysis
        </h1>
        <p className="text-muted-foreground">Compare budgeted amounts from Work Orders against actual labor costs.</p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Analysis per Work Order</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search by WO# or Client..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
            <Select onValueChange={(val) => setSortConfig(val === 'none' ? null : { key: val.split('_')[0] as any, direction: val.split('_')[1] as any })} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'variance_asc'}>
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent>
                <SelectItem value="variance_asc">Most Over-Budget</SelectItem>
                <SelectItem value="variance_desc">Most Under-Budget</SelectItem>
                <SelectItem value="projectBudget_desc">Budget: High-Low</SelectItem>
                <SelectItem value="actualLabourCost_desc">Actual Cost: High-Low</SelectItem>
              </SelectContent>
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
                  <TableHead className="text-right">Project Budget</TableHead>
                  <TableHead className="text-right">Actual Labour Cost</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? paginatedData.map(item => (
                  <TableRow key={item.workOrderId}>
                    <TableCell className="font-medium">{item.workOrderNumber}</TableCell>
                    <TableCell>{item.organizationName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.projectBudget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.actualLabourCost)}</TableCell>
                    <TableCell className="text-right"><VarianceIndicator value={item.variance} /></TableCell>
                  </TableRow>
                )) : (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No data available for this report.</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {sortedAndFilteredData.length > 0 && (<CardFooter className="border-t pt-2"><DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={analysisData.length} filteredItemCount={sortedAndFilteredData.length} /></CardFooter>)}
      </Card>
    </div>
  );
}
