
'use client';

import type { Company, WorkOrder, ServiceVisitReport, UserProfile } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { DigitalFingerprint } from '@/components/auth/digital-fingerprint';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Separator } from '../ui/separator';

interface SvrPrintLayoutProps {
  report: ServiceVisitReport | null;
  company: Company | null;
  workOrder: WorkOrder | null;
  addWatermark: boolean;
  showSignatureArea: boolean;
  addDigitalSignature: boolean;
  userProfile?: UserProfile | null;
}

export default function SvrPrintLayout({
  report,
  company,
  workOrder,
  addWatermark = false,
  showSignatureArea = false,
  addDigitalSignature = false,
  userProfile,
}: SvrPrintLayoutProps) {
  if (!report || !company || !workOrder) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const basePageClass = "bg-white p-8 font-serif text-gray-800 relative print-page-break min-h-[1123px]";
  const companyLogoHeight = "max-h-20 print:max-h-16";
  const tableCellClass = "px-2 py-1.5 text-sm print:text-[9pt]";
  const tableHeaderClass = "bg-gray-100 print:bg-gray-50";

  return (
    <div className={cn(basePageClass, "relative overflow-hidden")}>
      {addWatermark && (
        <div className="absolute inset-0 grid grid-cols-3 gap-x-8 gap-y-24 pointer-events-none -z-0 overflow-hidden opacity-[0.04] print:opacity-[0.03]">
          {Array(12).fill(0).map((_, i) => (
            <p key={i} className="font-extrabold text-gray-400 transform -rotate-45 whitespace-nowrap select-none uppercase text-5xl print:text-4xl" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.1)', letterSpacing: '0.05em' }}>
              {company.name}
            </p>
          ))}
        </div>
      )}
      <div className="relative z-10">
        <header className="flex justify-between items-start mb-8 border-b pb-4">
          <div className="w-2/3">
            {company.logoUrl && (company.logoUrl.startsWith('data:image') || company.logoUrl.startsWith('http')) ? (
              <Image src={company.logoUrl} alt={`${company.name} Logo`} width={120} height={60} className={cn("object-contain w-auto mb-2", companyLogoHeight)} data-ai-hint="company logo"/>
            ) : (
              <div className={cn("bg-gray-200 flex items-center justify-center text-gray-500 mb-2 text-xs rounded border border-gray-300 h-12 w-24")} data-ai-hint="logo placeholder">
                Logo
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-800">{company.name}</h1>
            {company.address && <p className="text-xs text-gray-600 mt-1">{company.address}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-primary uppercase tracking-wider">Service Visit Report</h2>
            <p className="text-sm text-gray-700 mt-2">Work Order #: {report.workOrderNumber}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <div><strong>Client:</strong> {workOrder.organizationName}</div>
            <div className="text-right"><strong>Visit Date:</strong> {formatDate(report.visitDate)}</div>
            <div><strong>Project Scope:</strong> {workOrder.scopeOfWork || 'N/A'}</div>
            <div className="text-right"><strong>Report Created By:</strong> {report.createdByName}</div>
        </div>

        <main className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold border-b pb-1 mb-2">Purpose of Visit</h3>
                <p className="text-sm">{report.purposeOfVisit}</p>
            </div>
            <div>
                <h3 className="text-lg font-semibold border-b pb-1 mb-2">Actions Taken / Work Performed</h3>
                <p className="text-sm whitespace-pre-wrap">{report.actionsTaken}</p>
            </div>
            {report.nextSteps && (
                <div>
                    <h3 className="text-lg font-semibold border-b pb-1 mb-2">Next Steps / Follow-up Actions</h3>
                    <p className="text-sm whitespace-pre-wrap">{report.nextSteps}</p>
                </div>
            )}
            {report.consumedItems && report.consumedItems.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold border-b pb-1 mb-2">Materials / Services Consumed</h3>
                    <Table>
                        <TableHeader>
                            <TableRow className={tableHeaderClass}>
                                <TableHead className={cn(tableCellClass, "font-semibold")}>Description</TableHead>
                                <TableHead className={cn(tableCellClass, "font-semibold text-right")}>Qty</TableHead>
                                <TableHead className={cn(tableCellClass, "font-semibold text-right")}>Unit</TableHead>
                                <TableHead className={cn(tableCellClass, "font-semibold text-right")}>Rate</TableHead>
                                <TableHead className={cn(tableCellClass, "font-semibold text-right")}>Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report.consumedItems.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className={tableCellClass}>{item.description}</TableCell>
                                    <TableCell className={cn(tableCellClass, "text-right")}>{item.consumedQuantity}</TableCell>
                                    <TableCell className={cn(tableCellClass, "text-right")}>{item.unit}</TableCell>
                                    <TableCell className={cn(tableCellClass, "text-right")}>{formatCurrency(item.rate)}</TableCell>
                                    <TableCell className={cn(tableCellClass, "text-right")}>{formatCurrency(item.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            {report.clientFeedback && (
                <div>
                    <h3 className="text-lg font-semibold border-b pb-1 mb-2">Client Feedback</h3>
                    <p className="text-sm italic">`{report.clientFeedback}`</p>
                </div>
            )}
        </main>
        
        {showSignatureArea && (
            <footer className="mt-24 page-break-inside-avoid">
                 <div className="flex justify-between items-end">
                     <div className="w-2/5 text-center">
                         <div className="min-h-[60px] mb-2 flex items-center justify-center relative">
                            <DigitalFingerprint
                                phrase1={userProfile?.signaturePhrase1}
                                phrase2={userProfile?.signaturePhrase2}
                                enabled={addDigitalSignature}
                            />
                            {addDigitalSignature && userProfile?.eSignature ? (
                                <Image src={userProfile.eSignature} alt="E-Signature" width={150} height={60} className="mx-auto h-[60px] object-contain relative" data-ai-hint="signature image"/>
                            ) : addDigitalSignature && userProfile?.fullName ? (
                                <p className="font-serif italic text-2xl h-[60px] flex items-center justify-center relative">{userProfile.fullName}</p>
                            ) : (<div className="h-[60px]"></div>)}
                         </div>
                         {addDigitalSignature && (
                             <div className="text-[8pt] text-gray-500 mt-0.5">
                                <p>Digitally signed by: {userProfile?.fullName || userProfile?.email}</p>
                                <p>Date: {new Date().toLocaleString()}</p>
                             </div>
                         )}
                         <div className="border-t border-gray-400 pt-1 mt-1">
                            <p className="font-semibold">{report.createdByName || 'Technician'}</p>
                            <p className="text-xs">({company?.name})</p>
                         </div>
                     </div>
                     <div className="w-2/5 text-center">
                         <div className="min-h-[60px] border-b border-gray-400 mb-2"></div>
                         <p className="font-semibold">Client/Recipient Signature</p>
                     </div>
                 </div>
            </footer>
        )}
      </div>
    </div>
  );
}
