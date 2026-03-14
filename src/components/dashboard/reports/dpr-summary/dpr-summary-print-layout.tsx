
'use client';

import type { Company, DailyProgressReport, UserProfile } from '@/types/server-only';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { DigitalFingerprint } from '@/components/auth/digital-fingerprint';

interface DprSummaryPrintLayoutProps {
  company: Company | null;
  reportData: DailyProgressReport[];
  isLoading: boolean;
  dateRange: { from: Date; to: Date };
  addWatermark?: boolean;
  showSignatureArea?: boolean;
  addDigitalSignature?: boolean;
  userProfile: UserProfile | null;
}

export default function DprSummaryPrintLayout({ company, reportData, isLoading, dateRange, addWatermark, showSignatureArea, addDigitalSignature, userProfile }: DprSummaryPrintLayoutProps) {
  
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) { return dateString; }
  };

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
  
  const reportTitle = `Daily Progress Report Summary`;
  const dateRangeString = `${formatDate(dateRange.from.toISOString())} to ${formatDate(dateRange.to.toISOString())}`;

  return (
    <div className={cn(basePageClass, "relative overflow-hidden")}>
       {addWatermark && company?.name && (
        <div className="absolute inset-0 grid grid-cols-3 gap-x-8 gap-y-24 pointer-events-none -z-0 overflow-hidden opacity-[0.04] print:opacity-[0.03]">
          {Array(12).fill(0).map((_, i) => (
            <p key={i} className="font-extrabold text-gray-400 transform -rotate-45 whitespace-nowrap select-none uppercase text-5xl print:text-4xl" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.1)', letterSpacing: '0.05em' }}>
              {company.name}
            </p>
          ))}
        </div>
      )}
      <div className="relative z-10">
        <header id="dpr-summary-print-header-content" className={headerClass}>
          <div className="col-span-1">
            {company.logoUrl && (company.logoUrl.startsWith('data:image') || company.logoUrl.startsWith('http')) ? (
              <Image src={company.logoUrl} alt={`${company.name} Logo`} width={60} height={30} className={cn("object-contain w-auto mb-0.5", companyLogoHeight)} data-ai-hint="company logo"/>
            ) : ( <div className={cn("bg-gray-200 flex items-center justify-center text-gray-500 mb-0.5 text-[7pt] rounded border border-gray-300 h-8 w-16 print:h-6 print:w-12")} data-ai-hint="logo placeholder">Logo</div> )}
            <h1 className="text-[10pt] print:text-[9pt] font-bold text-gray-800 print:leading-tight">{company.name}</h1>
            {company.address && <p className="text-[7pt] print:text-[6pt] text-gray-600 whitespace-pre-line print:leading-snug">{company.address}</p>}
          </div>
          <div className="col-span-2 text-right">
            <h2 className="text-lg print:text-base font-bold text-primary uppercase tracking-wider">{reportTitle}</h2>
            <p className="text-sm print:text-xs text-muted-foreground">{dateRangeString}</p>
            {company.gstin && <p className="text-[7pt] print:text-[6pt] text-gray-600">GSTIN: {company.gstin}</p>}
          </div>
        </header>
        
        <div className="printable-dpr-summary-main-content">
          {reportData.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No DPRs found matching the criteria.</div>
          ) : (
            reportData.map((report, index) => (
                <div key={report.id || index} className="page-break-inside-avoid mb-4 border-b pb-2">
                    <h3 className="font-bold text-sm mb-2">DPR for WO# {report.workOrderNumber} - {formatDate(report.reportDate)}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div><strong>Work up to Yesterday:</strong> {report.workUpToYesterday}</div>
                        <div><strong>Today`s Planning:</strong> {report.todaysPlanning}</div>
                        <div><strong>Today`s Allocation:</strong> {report.todaysWorkAllocation}</div>
                        <div><strong>Today`s Completion:</strong> {report.todaysCompletion}</div>
                        <div className="md:col-span-2"><strong>Work Rating:</strong> {report.workRating}/10</div>
                    </div>
                </div>
            ))
          )}
        </div>
         {showSignatureArea && (
            <footer className="mt-24 page-break-inside-avoid">
                <div className="flex justify-between items-end">
                <div className="w-2/5 text-center">
                    <div className="min-h-[50px] mb-1 flex items-center justify-center relative">
                        <DigitalFingerprint
                            phrase1={userProfile?.signaturePhrase1}
                            phrase2={userProfile?.signaturePhrase2}
                            enabled={!!addDigitalSignature}
                        />
                        {addDigitalSignature && userProfile?.eSignature ? (
                            <Image src={userProfile.eSignature} alt="E-Signature" width={120} height={50} className="mx-auto h-[50px] object-contain relative" data-ai-hint="signature image"/>
                        ) : addDigitalSignature && userProfile?.fullName ? (
                            <p className="font-serif italic text-2xl h-[50px] flex items-center justify-center relative">{userProfile.fullName}</p>
                        ) : (
                            <div className="h-[50px]"></div>
                        )}
                    </div>
                    {addDigitalSignature && (
                        <div className="text-[8pt] text-gray-500 mt-0.5">
                            <p>Digitally signed by: {userProfile?.fullName || userProfile?.email}</p>
                            <p>Date: {new Date().toLocaleString()}</p>
                        </div>
                    )}
                    <div className="border-t border-gray-400 pt-1 mt-1">
                        <p className="font-semibold">{company.name}</p>
                        <p>(Authorized Signature)</p>
                    </div>
                </div>
                </div>
            </footer>
        )}
      </div>
    </div>
  );
}
