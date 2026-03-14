
'use client';

import type { Company, WorkOrder, DailyProgressReport } from '@/types/server-only';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { Badge } from '../ui/badge';
import { formatCurrency } from '@/lib/utils';

interface DprSummaryPrintLayoutProps {
  company: Company | null;
  selectedWorkOrderDetails: WorkOrder | null;
  reportData: DailyProgressReport[];
  dateRange: { from: Date; to: Date } | undefined;
  isLoading: boolean;
}

export default function DprSummaryPrintLayout({
  company,
  selectedWorkOrderDetails,
  reportData,
  dateRange,
  isLoading,
}: DprSummaryPrintLayoutProps) {
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    try {
      return format(typeof date === 'string' ? parseISO(date) : date, 'dd MMM yyyy');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const reportTitle = `DPR SUMMARY: ${dateRange?.from ? formatDate(dateRange.from) : ''} TO ${dateRange?.to ? formatDate(dateRange.to) : ''} (${selectedWorkOrderDetails ? `WO# ${selectedWorkOrderDetails.workOrderNumber}` : `ALL ORDERS FOR ${company?.name || ''}`})`;

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
  const basePageClass = "bg-white p-2 sm:p-3 print:p-0 dpr-summary-print-content relative min-h-[700px] print:min-h-0";
  const headerClass = "grid grid-cols-3 gap-2 items-start pb-2 mb-2 border-b print:pb-0.5 print:mb-0.5";
  const tableCellClass = "px-1 py-0.5 text-[8pt] print:text-[7pt] text-gray-700 print:leading-tight";
  const tableHeaderClass = "bg-gray-100 print:bg-gray-50";


  return (
    <div className={cn(basePageClass, "relative overflow-hidden")}>
      <div>
        <header id="dpr-summary-print-header-content" className={headerClass}>
          <div className="col-span-1">
            {company.logoUrl ? (
              <Image src={company.logoUrl} alt={`${company.name} Logo`} width={60} height={30} className={cn("object-contain w-auto mb-0.5", companyLogoHeight)} data-ai-hint="company logo"/>
            ) : (
               <div className={cn("bg-gray-200 flex items-center justify-center text-gray-500 mb-0.5 text-[7pt] rounded border border-gray-300 h-8 w-16 print:h-6 print:w-12")} data-ai-hint="logo placeholder">Logo</div>
            )}
            <h1 className="text-[10pt] print:text-[9pt] font-bold text-gray-800 print:leading-tight">{company.name}</h1>
            {company.address && <p className="text-[7pt] print:text-[6pt] text-gray-600 whitespace-pre-line print:leading-snug">{company.address}</p>}
          </div>
          <div className="col-span-2 text-right">
            <h2 className="text-lg print:text-base font-bold text-primary uppercase tracking-wider">{reportTitle}</h2>
            {company.gstin && <p className="text-[7pt] print:text-[6pt] text-gray-600">GSTIN: {company.gstin}</p>}
          </div>
        </header>
        
        <div className="printable-dpr-summary-main-content">
          {reportData.map((dpr, index) => (
            <div key={dpr.id || index} className="mb-3 p-2 border rounded-lg page-break-inside-avoid">
              <div className="grid grid-cols-3 gap-x-2 mb-1 text-[8pt] print:text-[7pt] font-medium">
                <p><strong>DPR Date:</strong> {formatDate(dpr.reportDate)}</p>
                <p><strong>WO#:</strong> {dpr.workOrderNumber}</p>
                <p><strong>Rating:</strong> {dpr.workRating}/10</p>
              </div>
              <div className="space-y-1 text-xs print:text-[8pt]">
                <p><strong>Work Up To Yesterday:</strong><br />{dpr.workUpToYesterday}</p>
                <p><strong>Today`s Completion:</strong><br />{dpr.todaysCompletion}</p>
              </div>
              {dpr.consumedItems && dpr.consumedItems.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs print:text-[7pt] font-semibold mb-0.5">Consumed Materials:</h4>
                  <ul className="list-disc list-inside text-xs print:text-[7pt] text-gray-600">
                    {dpr.consumedItems.map((item, itemIdx) => (
                      <li key={itemIdx}>{item.consumedQuantity} {item.unit} of {item.description}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
