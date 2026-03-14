
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Company, WorkOrder, DailyProgressReport, UserProfile } from '@/types/server-only';
import { Printer, X, Download, Loader2, Calendar as CalendarIcon, Eye, ArrowLeft, PenLine } from 'lucide-react';
import LabourSummaryPrintLayout from './labour-summary-print-layout';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { User } from 'firebase/auth';
import { format, parseISO, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { useLoading } from '@/contexts/loading-context';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { LayoutTemplate } from 'lucide-react';
import type html2pdf from 'html2pdf.js';

interface ProcessedLabourData {
  id?: string;
  workerName: string;
  role: string;
  workOrderNumber: string;
  dailyWage: number;
  daysPresent: number;
  totalHours: number;
  totalEarned: number;
  totalAdvancesPaid: number;
  netPayable: number;
}
interface ReportData {
  company: Company | null;
  workOrder: WorkOrder | null;
  reportData: ProcessedLabourData[];
}
interface LabourSummaryPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  user: User | null; 
}

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export default function LabourSummaryPrintModal({ isOpen, onOpenChange, userId, user }: LabourSummaryPrintModalProps) {
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('all');

  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const { setIsLoading } = useLoading();
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');


  useEffect(() => {
    if (userId && isOpen && user) {
      const fetchCompanies = async () => {
        setIsLoadingCompanies(true);
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/companies?dataOwnerId=${userId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error('Failed to fetch companies');
          const companiesData: Company[] = await response.json();
          const companyOptions = companiesData.map(doc => ({ value: doc.id!, label: doc.name, data: { id: doc.id, ...doc } as Company }));
          setCompanies(companyOptions);
        } catch (error) {
          console.error("Error fetching companies for report:", error);
          toast({ title: "Error", description: "Could not load companies.", variant: "destructive" });
        }
        setIsLoadingCompanies(false);
        setIsLoading(false);
      };
      fetchCompanies();
    } else {
      setCompanies([]);
      setSelectedCompanyId('');
      setWorkOrders([]);
      setSelectedWorkOrderId('all');
      setReportData(null);
    }
  }, [userId, isOpen, toast, user, setIsLoading]);

  useEffect(() => {
    if (userId && selectedCompanyId && isOpen && user) {
      const fetchWorkOrders = async () => {
        setIsLoadingWorkOrders(true);
        setWorkOrders([]);
        setSelectedWorkOrderId('all');
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/work-orders?dataOwnerId=${userId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error("Failed to fetch work orders");
          const allWorkOrders: WorkOrder[] = await response.json();
          const filteredWOs = allWorkOrders.filter(wo => wo.companyId === selectedCompanyId);
          const woOptions = filteredWOs.map(doc => ({
            value: doc.id!,
            label: `${doc.workOrderNumber} - ${doc.organizationName}`,
            data: doc
          }));
          setWorkOrders([{ value: 'all', label: 'All Work Orders for this Company' }, ...woOptions]);
        } catch (error) {
          console.error("Error fetching work orders for company:", error);
          toast({ title: "Error", description: "Could not load work orders for the selected company.", variant: "destructive" });
          setWorkOrders([{ value: 'all', label: 'All Work Orders for this Company' }]);
        }
        setIsLoadingWorkOrders(false);
      };
      fetchWorkOrders();
    } else {
      setWorkOrders([{ value: 'all', label: 'Select a company first' }]);
      setIsLoadingWorkOrders(false);
    }
  }, [userId, selectedCompanyId, isOpen, toast, user]);

  const handleGeneratePreview = async () => {
    if (!selectedCompanyId || !selectedMonth || !selectedYear || !user) {
      toast({ title: "Missing Information", description: "Please select company, month, and year.", variant: "destructive" });
      setReportData(null);
      return;
    }
    setIsLoadingReport(true);
    setReportData(null);
    try {
      const idToken = await user.getIdToken();
      const params = new URLSearchParams({
        companyId: selectedCompanyId,
        month: selectedMonth,
        year: selectedYear,
      });
      if (selectedWorkOrderId && selectedWorkOrderId !== 'all') {
        params.append('workOrderId', selectedWorkOrderId);
      }
      const response = await fetch(`/api/reports/labour-summary?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate report: ${response.status}`);
      }
      const data = await response.json();
      setReportData(data);
      if (window.innerWidth < 768) {
        setMobileView('preview');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoadingReport(false);
  };
  
  const handleDownloadPdf = () => {
    const element = document.getElementById('printable-labour-summary-content-desktop') ?? document.getElementById('printable-labour-summary-content-mobile');
    if (!element) {
      toast({ title: "Download Error", description: "Cannot find content to download.", variant: "destructive" });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait." });
    
    const companyName = companies.find(c => c.value === selectedCompanyId)?.label || 'LabourSummary';
    const monthName = MONTHS.find(m => m.value === parseInt(selectedMonth))?.label || 'Month';
    const woIdentifier = selectedWorkOrderId === 'all' ? 'AllWOs' : workOrders.find(wo => wo.value === selectedWorkOrderId)?.label.split(' ')[0] || selectedWorkOrderId;
    
    const opt = {
      filename: `${companyName}_LabourSummary_${monthName}_${selectedYear}_${woIdentifier}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
    };

    import('html2pdf.js').then(html2pdfModule => {
      const html2pdf = html2pdfModule.default;
      html2pdf().from(element).set(opt).toPdf().get('pdf').then(function (pdf) {
        var totalPages = pdf.internal.getNumberOfPages();
        for (var i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(150);
          pdf.text(
            `Page ${i} of ${totalPages}`,
            pdf.internal.pageSize.getWidth() - 0.5,
            pdf.internal.pageSize.getHeight() - 0.2,
            { align: 'right' }
          );
        }
        return pdf;
      }).save().then(() => {
        toast({ title: "Download Started" });
      }).catch((err) => {
        toast({ title: "Download Failed", variant: "destructive" });
      }).finally(() => {
        setIsDownloading(false);
      });
    });
  };
  
  const OptionsPanel = () => (
     <div className="space-y-4">
      <div>
        <Label htmlFor="companySelectReport">Company*</Label>
        {isLoadingCompanies ? <Skeleton className="h-10 w-full mt-1" /> : (<Combobox options={companies} value={selectedCompanyId} onChange={(value) => { setSelectedCompanyId(value); setReportData(null); setSelectedWorkOrderId('all');}} placeholder="Select company..." searchPlaceholder="Search companies..." disabled={companies.length === 0} emptyResultText={isLoadingCompanies ? "Loading..." : "No companies found."} className="mt-1"/>)}
      </div>
      <div>
        <Label htmlFor="workOrderSelectReport">Work Order (Optional)</Label>
        <Combobox
          options={workOrders}
          value={selectedWorkOrderId}
          onChange={(value) => { setSelectedWorkOrderId(value); setReportData(null); }}
          placeholder="All Work Orders for Company"
          searchPlaceholder="Search work orders..."
          disabled={!selectedCompanyId || isLoadingWorkOrders || workOrders.length <= 1}
          emptyResultText={!selectedCompanyId ? "Select a company first." : (isLoadingWorkOrders ? "Wait... Work Orders loading" : "No specific WOs.")}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="monthSelectReport">Month*</Label>
          <Select value={selectedMonth} onValueChange={(value) => {setSelectedMonth(value); setReportData(null);}}>
            <SelectTrigger id="monthSelectReport" className="mt-1"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>{MONTHS.map(month => <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="yearInputReport">Year*</Label>
          <Select value={selectedYear} onValueChange={(value) => {setSelectedYear(value); setReportData(null);}}>
            <SelectTrigger id="yearInputReport" className="mt-1"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>{YEARS.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleGeneratePreview} className="w-full" disabled={!selectedCompanyId || isLoadingCompanies || isLoadingWorkOrders || isLoadingReport}>
        {isLoadingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
        {reportData ? "Update Preview" : "Generate Preview"}
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-full flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden sticky top-0 bg-background pt-6 px-6 z-10">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> Labour Summary Report</DialogTitle>
          <DialogDescription>Select company, month, year, and optionally a Work Order to generate a labour payment summary report.</DialogDescription>
        </DialogHeader>

        {/* Mobile View */}
        <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col">
          {mobileView === 'options' ? (
            <div className="flex flex-col flex-grow">
              <div className="flex-grow">
                  <OptionsPanel />
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                  <DialogClose asChild><Button variant="outline" className="w-full">Cancel</Button></DialogClose>
                  <Button onClick={() => setMobileView('preview')} className="w-full" disabled={!reportData}>
                      <Eye className="mr-2 h-4 w-4"/> Preview Report
                  </Button>
              </DialogFooter>
            </div>
          ) : (
             <>
              <div className="flex-1 overflow-auto -mx-4 -my-4 bg-gray-50 p-2">
                 <div id="printable-labour-summary-content-mobile" className="mx-auto w-[297mm] min-h-[210mm] print:min-h-0">
                   <LabourSummaryPrintLayout
                    company={reportData?.company || null}
                    selectedWorkOrderDetails={reportData?.workOrder || null}
                    reportData={reportData?.reportData || []}
                    reportMonthYear={format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1), "MMMM yyyy")}
                    isLoading={isLoadingReport}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Options</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading || isLoadingReport}>{isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}</Button>
              </DialogFooter>
            </>
          )}
        </div>


        {/* Desktop View */}
        <div className="hidden md:grid grid-cols-[280px_1fr] flex-1 overflow-hidden px-6 pb-6">
          <div className="flex flex-col space-y-4 overflow-y-auto border-r pr-4">
            <OptionsPanel />
          </div>
          <div className="flex-1 p-2 bg-gray-50 overflow-auto border rounded-md shadow-inner">
            <div id="printable-labour-summary-content-desktop" className="mx-auto w-[297mm] min-h-[210mm] print:min-h-0">
              <LabourSummaryPrintLayout
                company={reportData?.company || null}
                selectedWorkOrderDetails={reportData?.workOrder || null}
                reportData={reportData?.reportData || []}
                reportMonthYear={format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1), "MMMM yyyy")}
                isLoading={isLoadingReport}
              />
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
