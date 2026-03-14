
'use client';

import type { Company, DailyProgressReport, WorkOrder, UserProfile } from '@/types/server-only';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { DigitalFingerprint } from '@/components/auth/digital-fingerprint';

interface DprPrintLayoutProps {
  report: DailyProgressReport | null;
  company: Company | null;
  workOrder: WorkOrder | null;
  isLoading: boolean;
  addWatermark?: boolean;
  showSignatureArea?: boolean;
  addDigitalSignature?: boolean;
  userProfile: UserProfile | null;
}

export default function DprPrintLayout({ report, company, workOrder, isLoading, addWatermark, showSignatureArea, addDigitalSignature, userProfile }: DprPrintLayoutProps) {
  
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) { return dateString; }
  };

  if (isLoading || !report || !company || !workOrder) {
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
  
  const companyLogoHeight = "max-h-12 print:max-h-10";
  const basePageClass = "bg-white p-2 sm:p-3 print:p-0 dpr-print-content relative min-h-[700px] print:min-h-0";
  const headerClass = "grid grid-cols-3 gap-2 items-start pb-2 mb-2 border-b print:pb-0.5 print:mb-0.5";
  
  const reportTitle = `Daily Progress Report`;

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
        <header id="dpr-print-header-content" className={headerClass}>
          <div className="col-span-1">
            {company.logoUrl && (company.logoUrl.startsWith('data:image') || company.logoUrl.startsWith('http')) ? (
              <Image src={company.logoUrl} alt={`${company.name} Logo`} width={60} height={30} className={cn("object-contain w-auto mb-0.5", companyLogoHeight)} data-ai-hint="company logo"/>
            ) : ( <div className={cn("bg-gray-200 flex items-center justify-center text-gray-500 mb-0.5 text-[7pt] rounded border border-gray-300 h-8 w-16 print:h-6 print:w-12")} data-ai-hint="logo placeholder">Logo</div> )}
            <h1 className="text-[10pt] print:text-[9pt] font-bold text-gray-800 print:leading-tight">{company.name}</h1>
            {company.address && <p className="text-[7pt] print:text-[6pt] text-gray-600 whitespace-pre-line print:leading-snug">{company.address}</p>}
          </div>
          <div className="col-span-2 text-right">
            <h2 className="text-lg print:text-base font-bold text-primary uppercase tracking-wider">{reportTitle}</h2>
            <p className="text-sm print:text-xs text-muted-foreground">For WO# {report.workOrderNumber}</p>
            <p className="text-sm print:text-xs text-muted-foreground">Date: {formatDate(report.reportDate)}</p>
            {company.gstin && <p className="text-[7pt] print:text-[6pt] text-gray-600">GSTIN: {company.gstin}</p>}
          </div>
        </header>
        
        <div className="printable-dpr-main-content">
          <div className="space-y-4 text-xs print:text-[8pt]">
              <div><strong>Work Up to Yesterday:</strong> {report.workUpToYesterday}</div>
              <div><strong>Today`s Planning:</strong> {report.todaysPlanning}</div>
              <div><strong>Today`s Allocation:</strong> {report.todaysWorkAllocation}</div>
              <div><strong>Today`s Completion:</strong> {report.todaysCompletion}</div>
              <div className="md:col-span-2"><strong>Work Rating:</strong> {report.workRating}/10</div>
          </div>

          {(report.consumedItems && report.consumedItems.length > 0) && (
              <div className="mt-4">
                  <h4 className="font-bold text-sm mb-1">Materials Consumed Today</h4>
                  <Table>
                      <TableHeader><TableRow><TableHead className="h-6 px-1 py-0.5 text-[7pt]">Item</TableHead><TableHead className="h-6 px-1 py-0.5 text-right text-[7pt]">Qty</TableHead></TableRow></TableHeader>
                      <TableBody>{report.consumedItems.map((item, idx) => (
                          <TableRow key={idx}><TableCell className="px-1 py-0.5 text-[7pt]">{item.description}</TableCell><TableCell className="px-1 py-0.5 text-right text-[7pt]">{item.consumedQuantity} {item.unit}</TableCell></TableRow>
                      ))}</TableBody>
                  </Table>
              </div>
          )}
        </div>
         {showSignatureArea && (
            <footer className="mt-24 page-break-inside-avoid">
                <div className="flex justify-between items-end">
                <div className="w-2/5 text-center text-[8pt]">
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
