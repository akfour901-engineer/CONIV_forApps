
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { Company, WorkOrder, DailyProgressReport } from '@/types';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { addDays, format as formatDateFn } from 'date-fns';
import DprSummaryPrintLayout from './dpr-summary-print-layout';
import { Printer, X, Download, Loader2, CalendarIcon as Calendar, Eye, ArrowLeft } from 'lucide-react';
import type html2pdf from 'html2pdf.js';

interface DprSummaryPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReportData {
  company: Company | null;
  workOrder: WorkOrder | null;
  reportData: DailyProgressReport[];
}

export default function DprSummaryPrintModal({ isOpen, onOpenChange }: DprSummaryPrintModalProps) {
  const { user, dataOwnerId } = useAuth();
  const { toast } = useToast();
  
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('all');
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: addDays(new Date(), -7), to: new Date() });
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');
  
  const resetState = useCallback(() => {
    setCompanies([]);
    setWorkOrders([]);
    setSelectedCompanyId('');
    setSelectedWorkOrderId('all');
    setDateRange({ from: addDays(new Date(), -7), to: new Date() });
    setReportData(null);
    setMobileView('options');
  }, []);

  useEffect(() => {
    if (isOpen && user && dataOwnerId) {
      const fetchCompanies = async () => {
        setIsLoadingCompanies(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
          if (!response.ok) throw new Error('Failed to fetch companies');
          const companiesData: Company[] = await response.json();
          setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name })));
        } catch (error) {
          toast({ title: "Error", description: "Could not load companies.", variant: "destructive" });
        } finally {
          setIsLoadingCompanies(false);
        }
      };
      fetchCompanies();
    } else {
        resetState();
    }
  }, [isOpen, user, dataOwnerId, toast, resetState]);

  useEffect(() => {
    if (user && dataOwnerId && selectedCompanyId) {
      const fetchWorkOrders = async () => {
        setIsLoadingWorkOrders(true);
        setWorkOrders([]);
        setSelectedWorkOrderId('all');
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
          if (!response.ok) throw new Error("Failed to fetch work orders");
          const allWorkOrders: WorkOrder[] = await response.json();
          const filteredWOs = allWorkOrders.filter(wo => wo.companyId === selectedCompanyId);
          setWorkOrders([{ value: 'all', label: 'All Work Orders for this Company' }, ...filteredWOs.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` }))]);
        } catch (error) {
          toast({ title: "Error", description: "Could not load work orders.", variant: "destructive" });
        } finally {
          setIsLoadingWorkOrders(false);
        }
      };
      fetchWorkOrders();
    }
  }, [user, dataOwnerId, selectedCompanyId, toast]);

  const handleGeneratePreview = async () => {
    if (!selectedCompanyId || !dateRange?.from || !dateRange?.to) {
      toast({ title: "Missing Information", description: "Please select company and a valid date range.", variant: "destructive" });
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
        startDate: formatDateFn(dateRange.from, 'yyyy-MM-dd'),
        endDate: formatDateFn(dateRange.to, 'yyyy-MM-dd'),
      });
      if (selectedWorkOrderId && selectedWorkOrderId !== 'all') {
        params.append('workOrderId', selectedWorkOrderId);
      }
      
      const response = await fetch(`/api/reports/dpr-summary?${params.toString()}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate report: ${response.status}`);
      }
      setReportData(await response.json());
      if (window.innerWidth < 768) {
        setMobileView('preview');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoadingReport(false);
  };
  
  const handleDownloadPdf = async () => {
    if (!reportData) {
        toast({ title: "Preview Not Ready", description: "Please generate preview first.", variant: "destructive" });
        return;
    }
    const element = document.getElementById('printable-dpr-summary-content');
    if (!element) {
      toast({ title: "Download Error", description: "Cannot find content to download.", variant: "destructive" });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait." });
    
    try {
        const html2pdf = (await import('html2pdf.js')).default;
        const opt = {
            margin:       [0.2, 0.2, 0.2, 0.2],
            filename:     `DPR_Summary_${reportData.company?.name || 'Report'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };
        await html2pdf().from(element).set(opt).toPdf().get('pdf').save();
        toast({ title: "Download Started", description: "Your DPR Summary PDF is downloading." });
    } catch (error) {
        toast({ title: "Download Failed", variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };

  const OptionsPanel = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <Combobox options={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} placeholder="Select Company..." searchPlaceholder="Search companies..." disabled={isLoadingCompanies} />
        <Combobox options={workOrders} value={selectedWorkOrderId} onChange={setSelectedWorkOrderId} placeholder="All Work Orders for Company" searchPlaceholder="Search work orders..." disabled={!selectedCompanyId || isLoadingWorkOrders} />
        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
      </div>
      <Button onClick={handleGeneratePreview} className="w-full" disabled={!selectedCompanyId || isLoadingReport}>
        {isLoadingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
        {reportData ? "Update Preview" : "Generate Preview"}
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-screen flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden sticky top-0 bg-background pt-6 px-6 z-10">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> DPR Summary Report</DialogTitle>
          <DialogDescription>Select filters to generate a consolidated Daily Progress Report.</DialogDescription>
        </DialogHeader>

        {/* Mobile View */}
        <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col">
          {mobileView === 'options' ? (
            <div className="flex flex-col flex-grow">
              <div className="flex-grow"><OptionsPanel /></div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <DialogClose asChild><Button variant="outline" className="w-full">Cancel</Button></DialogClose>
                <Button onClick={() => setMobileView('preview')} className="w-full" disabled={!reportData}><Eye className="mr-2 h-4 w-4"/> Preview</Button>
              </DialogFooter>
            </div>
          ) : (
             <>
              <div id="printable-dpr-summary-content" className="flex-1 overflow-y-auto -mx-4 -my-4 bg-gray-50 p-2">
                {dateRange?.from && dateRange?.to && (
                  <DprSummaryPrintLayout
                      company={reportData?.company || null}
                      selectedWorkOrderDetails={reportData?.workOrder || null}
                      reportData={reportData?.reportData || []}
                      dateRange={{ from: dateRange.from, to: dateRange.to }}
                      isLoading={isLoadingReport}
                    />
                )}
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Options</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading || isLoadingReport}>{isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />} Download</Button>
              </DialogFooter>
            </>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:grid grid-cols-[280px_1fr] flex-1 overflow-hidden px-6 pb-6">
          <div className="flex flex-col space-y-4 overflow-y-auto border-r pr-4"><OptionsPanel /></div>
          <div className="flex-1 p-2 bg-gray-50 overflow-y-auto border rounded-md shadow-inner">
            <div id="printable-dpr-summary-content" className="mx-auto w-[297mm] min-h-[210mm] print:min-h-0">
               {dateRange?.from && dateRange?.to && (
                <DprSummaryPrintLayout
                    company={reportData?.company || null}
                    selectedWorkOrderDetails={reportData?.workOrder || null}
                    reportData={reportData?.reportData || []}
                    dateRange={{ from: dateRange.from, to: dateRange.to }}
                    isLoading={isLoadingReport}
                  />
               )}
            </div>
          </div>
        </div>
        <DialogFooter className="hidden md:flex sm:justify-end gap-2 p-6 pt-4 border-t shrink-0">
          <DialogClose asChild><Button type="button" variant="outline"><X className="mr-2 h-4 w-4" /> Close</Button></DialogClose>
          <Button type="button" onClick={handleDownloadPdf} disabled={!reportData || isDownloading || isLoadingReport}>
            {isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
