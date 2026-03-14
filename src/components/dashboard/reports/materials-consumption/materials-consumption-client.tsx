
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HardHat, AlertTriangle, ArrowLeft, Package, Search } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import type { Company, WorkOrder, DailyProgressReport, UserProfile, TeamMember, AppConfiguration } from '@/types/server-only';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from '@/lib/utils';
import { useLoading } from '@/contexts/loading-context';
import MaterialsConsumptionLoading from './loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { DateRange } from 'react-day-picker';
import { addDays, format as formatDateFn } from 'date-fns';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Input } from '@/components/ui/input';

interface AggregatedItem {
    description: string;
    unit: string;
    totalQuantity: number;
    totalAmount: number;
    workOrderNumbers: string[];
}

export default function MaterialsConsumptionClient() {
  const { user, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading } = useAuth();
  const [reportData, setReportData] = useState<AggregatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const canView = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewFinancialSummaries;

  useEffect(() => {
    if (user && dataOwnerId) {
      const fetchCompanies = async () => {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!response.ok) throw new Error('Failed to fetch companies');
          const companiesData: Company[] = await response.json();
          setCompanies(companiesData.map((c) => ({ value: c.id!, label: c.name })));
        } catch (e: any) {
          toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchCompanies();
    }
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (user && dataOwnerId && selectedCompanyId) {
        const fetchWorkOrders = async () => {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}&companyId=${selectedCompanyId}`, {
                headers: { Authorization: `Bearer ${idToken}` },
            });
            if (response.ok) {
                const woData: WorkOrder[] = await response.json();
                setWorkOrders([{ value: 'all', label: 'All Work Orders' }, ...woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` }))]);
            }
        };
        fetchWorkOrders();
    }
  }, [selectedCompanyId, user, dataOwnerId]);

  const handleGenerateReport = useCallback(async () => {
    if (!selectedCompanyId || !dateRange?.from || !dateRange?.to) {
      toast({ title: "Missing Information", description: "Please select a company and a date range.", variant: "destructive" });
      setReportData([]);
      return;
    }
    if (!user || !dataOwnerId) return;

    setIsLoading(true);
    setReportData([]);
    try {
        const idToken = await user.getIdToken();
        const params = new URLSearchParams({
            companyId: selectedCompanyId,
            startDate: formatDateFn(dateRange.from, 'yyyy-MM-dd'),
            endDate: formatDateFn(dateRange.to, 'yyyy-MM-dd'),
        });
        if (selectedWorkOrderId && selectedWorkOrderId !== 'all') {
            params.append('workOrderId', selectedWorkOrderId);
        }
        
        const response = await fetch(`/api/reports/materials-consumption?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to generate report');
        setReportData(await response.json());
        toast({ title: "Report Generated" });
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [user, dataOwnerId, selectedCompanyId, selectedWorkOrderId, dateRange, toast]);
  
  const filteredData = useMemo(() => {
    return reportData.filter(item => 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.workOrderNumbers.join(',').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [reportData, searchTerm]);

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);


  if (authLoading) return <MaterialsConsumptionLoading />;
  
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
            <Package className="mr-3 h-7 w-7 text-primary" /> Materials Consumption Report
          </h1>
          <p className="text-muted-foreground">
            Analyze materials consumed in Daily Progress Reports.
          </p>
        </div>
         <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/reports"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Reports</Link>
        </Button>
      </div>

       <Card>
        <CardHeader><CardTitle>Report Options</CardTitle><CardDescription>Select filters to generate the report.</CardDescription></CardHeader>
        <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Combobox options={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} placeholder="Select Company..."/>
            <Combobox options={workOrders} value={selectedWorkOrderId} onChange={setSelectedWorkOrderId} placeholder="All Work Orders" disabled={!selectedCompanyId || workOrders.length <= 1} />
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
        </CardContent>
        <CardFooter><Button onClick={handleGenerateReport} disabled={isLoading}>Generate Report</Button></CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Consumption Summary</CardTitle>
            <Input placeholder="Search materials..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm mt-2"/>
        </CardHeader>
        <CardContent>
            {isLoading ? <div className="text-center p-4">Loading...</div> : (
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>Material Description</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Total Consumed</TableHead><TableHead className="text-right">Total Value</TableHead><TableHead>Used In WOs</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {paginatedData.length > 0 ? paginatedData.map(item => (
                            <TableRow key={item.description}>
                                <TableCell className="font-medium">{item.description}</TableCell>
                                <TableCell>{item.unit}</TableCell>
                                <TableCell className="text-right">{item.totalQuantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.totalAmount)}</TableCell>
                                <TableCell className="text-xs">{item.workOrderNumbers.join(', ')}</TableCell>
                            </TableRow>
                        )) : (<TableRow><TableCell colSpan={5} className="text-center h-24">No consumption data found for the selected criteria.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
        {filteredData.length > 0 && (
            <CardFooter>
                <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} canNextPage={currentPage < totalPages} canPreviousPage={currentPage > 1} itemCount={reportData.length} filteredItemCount={filteredData.length}/>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
