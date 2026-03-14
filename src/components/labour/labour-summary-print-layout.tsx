'use client';

import type { Company, WorkOrder } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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

interface LabourSummaryPrintLayoutProps {
  company: Company | null;
  selectedWorkOrderDetails: WorkOrder | null;
  reportData: ProcessedLabourData[];
  reportMonthYear: string;
  isLoading: boolean;
}

export default function LabourSummaryPrintLayout({ company, selectedWorkOrderDetails, reportData, reportMonthYear, isLoading }: LabourSummaryPrintLayoutProps) {
  
  const formatCurrency = (amount: number | undefined) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  let reportTitle = `Labour Summary Report - ${reportMonthYear}`;
  if (selectedWorkOrderDetails) {
    reportTitle += ` (WO: ${selectedWorkOrderDetails.workOrderNumber})`;
  } else if (!selectedWorkOrderDetails) {
     reportTitle += ` (All Work Orders for ${company?.name || 'Company'})`;
  }
  
  if (isLoading) {
    return (
      <div className="p-4 print:p-0">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-6" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-2 p-2 border rounded">
            <Skeleton className="h-5 w-full mb-1" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!company) {
    return <div className="p-4 text-center text-red-500">Company data not available.</div>;
  }
  
  const companyLogoHeight = "max-h-12 print:max-h-10";
  const basePageClass = "bg-white p-2 sm:p-3 print:p-0 labour-summary-print-content relative min-h-[700px] print:min-h-0";
  const headerClass = "grid grid-cols-3 gap-2 items-start pb-2 mb-2 border-b print:pb-0.5 print:mb-0.5";
  const tableCellClass = "px-1 py-0.5 text-[8pt] print:text-[7pt] text-gray-700 print:leading-tight";
  const tableHeaderClass = "bg-gray-100 print:bg-gray-50";

  return (
    <div className={cn(basePageClass, "relative overflow-hidden")}>
      <div>
        <header id="labour-summary-print-header-content" className={headerClass}>
          <div className="col-span-1">
            {company.logoUrl && (company.logoUrl.startsWith('data:image') || company.logoUrl.startsWith('http')) ? (
              <Image src={company.logoUrl} alt={`${company.name} Logo`} width={60} height={30} className={cn("object-contain w-auto mb-0.5", companyLogoHeight)} data-ai-hint="company logo"/>
            ) : ( <div className={cn("bg-gray-200 flex items-center justify-center text-gray-500 mb-0.5 text-[7pt] rounded border border-gray-300 h-8 w-16 print:h-6 print:w-12")} data-ai-hint="logo placeholder">Logo</div> )}
            <h1 className="text-[10pt] print:text-[9pt] font-bold text-gray-800 print:leading-tight">{company.name}</h1>
            {company.address && <p className="text-[7pt] print:text-[6pt] text-gray-600 whitespace-pre-line print:leading-snug">{company.address}</p>}
          </div>
          <div className="col-span-2 text-right">
            <h2 className="text-lg print:text-base font-bold text-primary uppercase tracking-wider">{reportTitle}</h2>
            {company.gstin && <p className="text-[7pt] print:text-[6pt] text-gray-600">GSTIN: {company.gstin}</p>}
          </div>
        </header>
        
        <div className="printable-labour-summary-main-content">
          {reportData.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No labour data found matching the criteria.</div>
          ) : (
          <Table className="min-w-full print:text-[7pt]">
            <TableHeader className={tableHeaderClass}>
              <TableRow>
                <TableHead className={cn(tableCellClass, "font-semibold w-[15%]")}>Worker Name</TableHead>
                <TableHead className={cn(tableCellClass, "font-semibold w-[15%]")}>Role</TableHead>
                <TableHead className={cn(tableCellClass, "font-semibold w-[20%]")}>Work Order #</TableHead>
                <TableHead className={cn(tableCellClass, "font-semibold text-right w-[10%]")}>Daily Wage</TableHead>
                <TableHead className={cn(tableCellClass, "font-semibold text-right w-[10%]")}>Days Present</TableHead>
                <TableHead className={cn(tableCellClass, "font-semibold text-right w-[10%]")}>Total Earned</TableHead>
                <TableHead className={cn(tableCellClass, "font-semibold text-right w-[10%]")}>Total Paid</TableHead>
                <TableHead className={cn(tableCellClass, "font-semibold text-right w-[10%]")}>Net Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white divide-y divide-gray-200 print:divide-gray-300">
              {reportData.map((lab) => (
                <TableRow key={lab.id} className="page-break-inside-avoid">
                  <TableCell className={tableCellClass}>{lab.workerName}</TableCell>
                  <TableCell className={tableCellClass}>{lab.role}</TableCell>
                  <TableCell className={tableCellClass}>{lab.workOrderNumber}</TableCell>
                  <TableCell className={cn(tableCellClass, "text-right")}>{formatCurrency(lab.dailyWage)}</TableCell>
                  <TableCell className={cn(tableCellClass, "text-right")}>{lab.daysPresent}</TableCell>
                  <TableCell className={cn(tableCellClass, "text-right")}>{formatCurrency(lab.totalEarned)}</TableCell>
                  <TableCell className={cn(tableCellClass, "text-right")}>{formatCurrency(lab.totalAdvancesPaid)}</TableCell>
                  <TableCell className={cn(tableCellClass, "text-right font-semibold")}>{formatCurrency(lab.netPayable)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </div>
      </div>
    </div>
  );
}
