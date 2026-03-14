
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Printer, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { Company, DailyProgressReport, UserProfile, WorkOrder } from '@/types/server-only';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/loading-context';
import DprSummaryLoading from './loading';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { addDays, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import DprSummaryPrintLayout from './dpr-summary-print-layout';
import { getIcon } from '@/components/icons';
import DprSummaryPrintModal from './dpr-summary-print-modal';

interface ReportData {
  company: Company | null;
  reportData: DailyProgressReport[];
}

export default function DprSummaryClient() {
  const { user, dataOwnerId, loading: authLoading, userProfile } = useAuth();
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingPrereqs, setIsLoadingPrereqs] = useState(true);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);


  useEffect(() => {
    if (user && dataOwnerId) {
      const fetchCompanies = async () => {
        setIsLoadingPrereqs(true);
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
          setIsLoadingPrereqs(false);
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
      setReportData(null);
      return;
    }
    if (!user) return;
    setIsLoadingReport(true);
    setReportData(null);
    try {
      const idToken = await user.getIdToken();
      const params = new URLSearchParams({
        companyId: selectedCompanyId,
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
      });
      if (selectedWorkOrderId && selectedWorkOrderId !== 'all') {
        params.append('workOrderId', selectedWorkOrderId);
      }
      const response = await fetch(`/api/reports/dpr-summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to generate report.');
      const data: ReportData = await response.json();
      setReportData(data);
      toast({ title: 'Report Generated', description: `Found ${data.reportData.length} DPRs.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingReport(false);
    }
  }, [user, selectedCompanyId, selectedWorkOrderId, dateRange, toast]);
  
  const handleOpenPrintModal = () => {
    if (!reportData || reportData.reportData.length === 0) {
      toast({ title: "No Data", description: "Generate a report with data first.", variant: "destructive"});
      return;
    }
    if (!dateRange || !dateRange.from || !dateRange.to) {
      toast({ title: "Date Range Missing", description: "A valid date range is required to print.", variant: "destructive" });
      return;
    }
    setIsPrintModalOpen(true);
  };


  if (authLoading || isLoadingPrereqs) return <DprSummaryLoading />;

  const DprIcon = getIcon('FileClock');

  return (
    <>
      <div className="space-y-6">
        <div className="print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold flex items-center">
                {DprIcon && <DprIcon className="mr-3 h-7 w-7 text-primary" />} Daily Progress Report (DPR) Summary
              </h1>
              <p className="text-muted-foreground">Generate a consolidated summary of DPRs for a selected period.</p>
            </div>
            <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
              <Link href="/dashboard/reports"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Reports</Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Report Options</CardTitle>
              <CardDescription>Select a company, an optional work order, and a date range to generate the report.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Combobox options={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} placeholder="Select Company..."/>
              <Combobox options={workOrders} value={selectedWorkOrderId} onChange={setSelectedWorkOrderId} placeholder="All Work Orders" disabled={!selectedCompanyId || workOrders.length <= 1} />
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={handleGenerateReport} disabled={isLoadingReport || !selectedCompanyId}>
                {isLoadingReport ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : 'Generate Report'}
              </Button>
              <Button onClick={handleOpenPrintModal} variant="secondary" disabled={!reportData || reportData.reportData.length === 0 || isLoadingReport}>
                  <Printer className="mr-2 h-4 w-4" />Print / Download PDF
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {reportData && (
          <Card>
            <CardHeader>
                <CardTitle>Report Preview</CardTitle>
                <CardDescription>A brief preview of the generated report. Click `Print / Download PDF` for more options.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>Company: {reportData.company?.name}</p>
                <p>Date Range: {dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : ''} - {dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : ''}</p>
                <p>Reports found: {reportData.reportData.length}</p>
            </CardContent>
          </Card>
        )}
      </div>
       {reportData && dateRange?.from && dateRange?.to && (
         <DprSummaryPrintModal 
            isOpen={isPrintModalOpen}
            onOpenChange={setIsPrintModalOpen}
            reportData={reportData}
            dateRange={{from: dateRange.from, to: dateRange.to}}
            userProfile={userProfile}
        />
      )}
    </>
  );
}
