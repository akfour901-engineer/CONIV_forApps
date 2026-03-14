
'use client';

import React, { useState, useEffect, useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { WorkOrderProfitabilityItem } from '@/app/api/reports/work-order-profitability/route';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from '@/lib/utils';
import { useLoading } from '@/contexts/loading-context';
import WorkOrderProfitabilityLoading from './work-order-profitability-loading';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Input } from '@/components/ui/input';

const ProfitLossIndicator = ({ value }: { value: number }) => {
    const isProfit = value >= 0;
    const isLoss = value < 0;
    return (
      <div className={cn("flex items-center justify-end font-semibold", isProfit ? "text-green-600" : "text-destructive")}>
        {isProfit ? <ArrowUpRight className="mr-1 h-4 w-4 shrink-0" /> : <ArrowDownRight className="mr-1 h-4 w-4 shrink-0" />}
        <span className="truncate">{formatCurrency(value)}</span>
      </div>
    );
};

export default function WorkOrderProfitabilityClient() {
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const [analysisData, setAnalysisData] = useState<WorkOrderProfitabilityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canView = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewFinancialSummaries;

  const fetchAnalysisData = useCallback(async () => {
    if (!user || !dataOwnerId || !canView) {
      if (!authLoading && !canView) toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/reports/work-order-profitability?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      setAnalysisData(await response.json());
    } catch (error: any) {
      toast({ title: "Error Loading Report", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, canView, authLoading, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchAnalysisData();
    }
  }, [authLoading, fetchAnalysisData]);

  const filteredData = useMemo(() => {
    return analysisData.filter(item => 
      item.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [analysisData, searchTerm]);

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  if (isLoading || authLoading) return <WorkOrderProfitabilityLoading />;
  
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view this report.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/reports">Back to Reports</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <TrendingUp className="mr-3 h-7 w-7 text-primary" /> Work Order Profitability
          </h1>
          <p className="text-muted-foreground">
            Analyze revenue vs. costs for each completed project.
          </p>
        </div>
         <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/reports"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Reports</Link>
        </Button>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Profitability Breakdown</CardTitle>
          <CardDescription>Compares revenue from paid invoices against all associated costs (expenses, POs, labour) for each work order.</CardDescription>
          <div className="pt-2">
            <Input
              placeholder="Search by WO# or Client..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Order #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Project Value</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Profit/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map(item => (
                    <TableRow key={item.workOrderId}>
                      <TableCell className="font-medium">{item.workOrderNumber}</TableCell>
                      <TableCell>{item.organizationName}</TableCell>
                      <TableCell><Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                      <TableCell className="text-right">{formatCurrency(item.projectValue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalCost)}</TableCell>
                      <TableCell className="text-right">
                        <ProfitLossIndicator value={item.profitLoss} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      No data to display. Ensure invoices are marked paid and expenses are linked to work orders.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {filteredData.length > itemsPerPage && (
          <CardFooter>
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              canPreviousPage={currentPage > 1}
              canNextPage={currentPage < totalPages}
              itemCount={analysisData.length}
              filteredItemCount={filteredData.length}
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
