
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HardHat, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { LabourCostAnalysisItem } from '@/app/api/reports/labour-cost-analysis/route';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from '@/lib/utils';
import { useLoading } from '@/contexts/loading-context';
import LabourCostAnalysisLoading from './labour-cost-analysis-loading';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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


export default function LabourCostAnalysisClient() {
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const [analysisData, setAnalysisData] = useState<LabourCostAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [searchTerm, setSearchTerm] = useState('');

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
      const response = await fetch(`/api/reports/labour-cost-analysis?dataOwnerId=${dataOwnerId}`, {
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

  if (isLoading || authLoading) return <LabourCostAnalysisLoading />;
  
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
            <HardHat className="mr-3 h-7 w-7 text-primary" /> Labour Cost Analysis
          </h1>
          <p className="text-muted-foreground">
            Analyze labour costs against project budgets.
          </p>
        </div>
         <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/reports"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Reports</Link>
        </Button>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Work Order vs. Labour Cost</CardTitle>
          <CardDescription>Compares the total value of each work order with the total labour payments made against it.</CardDescription>
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
                  <TableHead className="text-right">Project Budget</TableHead>
                  <TableHead className="text-right">Actual Labour Cost</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map(item => (
                    <TableRow key={item.workOrderId}>
                      <TableCell className="font-medium">{item.workOrderNumber}</TableCell>
                      <TableCell>{item.organizationName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.projectBudget)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.actualLabourCost)}</TableCell>
                      <TableCell className="text-right">
                        <ProfitLossIndicator value={item.variance} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No data to display. Ensure labourers have payments logged against work orders.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
