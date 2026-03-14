
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { EstimateVsActualsData } from '@/app/api/reports/estimate-vs-actuals/route';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from '@/lib/utils';
import { useLoading } from '@/contexts/loading-context';
import EstimateVsActualsLoading from './estimate-vs-actuals-loading';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const VarianceIndicator = ({ value }: { value: number }) => {
    const isOverBudget = value < 0;
    const isUnderBudget = value > 0;
    return (
      <div className={cn("flex items-center justify-end font-semibold", isUnderBudget && "text-green-600", isOverBudget && "text-destructive")}>
        {isUnderBudget ? <ArrowUpRight className="mr-1 h-4 w-4 shrink-0" /> : <ArrowDownRight className="mr-1 h-4 w-4 shrink-0" />}
        <span className="truncate">{formatCurrency(value)}</span>
      </div>
    );
};

export default function EstimateVsActualsClient() {
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const [analysisData, setAnalysisData] = useState<EstimateVsActualsData[]>([]);
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
      const response = await fetch(`/api/reports/estimate-vs-actuals?dataOwnerId=${dataOwnerId}`, {
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
      item.estimateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.workOrderNumber && item.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [analysisData, searchTerm]);

  if (isLoading || authLoading) return <EstimateVsActualsLoading />;
  
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
            <Target className="mr-3 h-7 w-7 text-primary" /> Estimate vs. Actuals
          </h1>
          <p className="text-muted-foreground">
            Compare budgeted costs from estimates with actual project expenditures.
          </p>
        </div>
         <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/reports"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Reports</Link>
        </Button>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Cost Variance Report</CardTitle>
          <CardDescription>
            Analyzes approved estimates against their corresponding work orders to track cost variance.
          </CardDescription>
          <div className="pt-2">
            <Input 
                placeholder="Search by Estimate #, WO #, or Client..." 
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
                  <TableHead>Estimate #</TableHead>
                  <TableHead>Work Order #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Estimated Amount</TableHead>
                  <TableHead className="text-right">Actual Cost</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map(item => (
                    <TableRow key={item.estimateId}>
                      <TableCell className="font-medium">{item.estimateNumber}</TableCell>
                      <TableCell>{item.workOrderNumber || 'N/A'}</TableCell>
                      <TableCell>{item.organizationName}</TableCell>
                      <TableCell><Badge variant={item.status === 'Completed' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                      <TableCell className="text-right">{formatCurrency(item.estimatedAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.actualCost)}</TableCell>
                      <TableCell className="text-right">
                        <VarianceIndicator value={item.variance} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      No approved estimates with corresponding work orders found.
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
