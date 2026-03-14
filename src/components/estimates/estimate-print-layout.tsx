
'use client';

import type { BankAccount, UserProfile, Estimate } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { DigitalFingerprint } from '@/components/auth/digital-fingerprint';

interface EstimatePrintLayoutProps {
  estimate: Estimate;
  userProfile?: UserProfile | null;
  selectedLayout?: string;
  showBankDetails?: boolean;
  showMyContactDetails?: boolean;
  addWatermark?: boolean;
  showSignatureArea?: boolean;
  addDigitalSignature?: boolean;
  hideValidUntil?: boolean;
  setIsLoadingBankAccount: (loading: boolean) => void;
  isLoadingBankAccount: boolean;
}

export default function EstimatePrintLayout({
  estimate,
  userProfile,
  selectedLayout = 'default',
  showBankDetails = false,
  showMyContactDetails = false,
  addWatermark = false,
  showSignatureArea = false,
  addDigitalSignature = false,
  hideValidUntil = false,
  setIsLoadingBankAccount,
  isLoadingBankAccount,
}: EstimatePrintLayoutProps) {
  const { user } = useAuth(); // Get user for auth token
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  
  useEffect(() => {
    const fetchBankAccount = async () => {
      const ownerId = estimate?.userId;
      if (showBankDetails && ownerId && estimate?.companyId && user) {
        setIsLoadingBankAccount(true);
        setBankAccount(null);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/bank-accounts/default-for-company?ownerId=${ownerId}&companyId=${estimate.companyId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (response.ok) {
            const data: BankAccount = await response.json();
            setBankAccount(data);
          } else {
            console.warn(`Could not fetch default bank account for company ${estimate.companyId}. Status: ${response.status}`);
            setBankAccount(null);
          }
        } catch (error) {
          console.error("EstimatePrintLayout: Error fetching bank account via API:", error);
          setBankAccount(null);
        } finally {
          setIsLoadingBankAccount(false);
        }
      } else {
        setBankAccount(null);
      }
    };

    if (showBankDetails && estimate && user) {
      fetchBankAccount();
    }
  }, [showBankDetails, estimate, setIsLoadingBankAccount, user]);

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) {
      try { return format(new Date(dateString), 'dd MMM yyyy'); }
      catch (parseError) { return dateString; }
    }
  };

  const styles = useMemo(() => {
    const base = {
      page: "bg-white p-4 sm:p-6 print:p-0 estimate-print-content relative min-h-[700px] print:min-h-0",
      header: "grid grid-cols-2 gap-4 items-start pb-4 mb-4 border-b print:pb-2 print:mb-2",
      mainTitle: "text-2xl font-bold text-primary uppercase tracking-tight",
      sectionTitle: "text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2",
      tableHeader: "bg-gray-100 print:bg-gray-50",
      tableCell: "px-2 py-1.5 text-sm print:text-[9pt]",
      companyLogoHeight: "max-h-16 print:max-s-h-12",
      watermarkContainer: "absolute inset-0 grid grid-cols-3 gap-x-8 gap-y-16 pointer-events-none overflow-hidden",
      watermarkOpacity: "opacity-[0.06] print:opacity-[0.05]",
      watermarkText: "font-extrabold text-gray-400 transform -rotate-45 whitespace-nowrap select-none uppercase text-2xl print:text-xl",
    };

    switch (selectedLayout) {
      case 'modern-minimal': return { ...base, header: "flex justify-between items-start pb-4 mb-4", mainTitle: "text-xl font-semibold text-gray-800 tracking-normal normal-case", sectionTitle: "text-xs font-bold text-gray-500 uppercase tracking-widest mb-2", tableHeader: "bg-transparent border-b-2 border-gray-300", tableCell: "px-1 py-2 text-[10pt] print:text-[8pt] border-b" };
      case 'classic-formal': return { ...base, page: cn(base.page, "font-serif"), header: "text-center block pb-4 mb-4", mainTitle: "text-3xl font-normal text-gray-900 tracking-widest normal-case", sectionTitle: "text-md font-bold text-gray-800 text-center border-t border-b py-1 my-3", tableHeader: "bg-gray-50 border-y" };
      case 'invoice-style': return { ...base, mainTitle: "text-2xl font-bold text-destructive uppercase tracking-widest", sectionTitle: "text-sm font-bold text-gray-800 mb-1", tableHeader: "bg-gray-800 text-white print:bg-gray-700" };
      case 'sleek': return { ...base, header: "block text-white bg-primary p-4 rounded-t-lg mb-4 print:rounded-none", mainTitle: "text-2xl font-bold text-white uppercase tracking-wider", sectionTitle: "text-primary font-bold text-sm mb-1 border-b-2 border-primary/50 pb-1", tableHeader: "bg-primary/10 text-primary-foreground print:bg-gray-100", tableCell: "px-2 py-2 text-sm print:text-[9pt]" };
      case 'compact': return { ...base, page: cn(base.page, "p-2 sm:p-3 print:p-0 text-xs print:text-[8pt]"), mainTitle: "text-xl font-bold text-primary uppercase", sectionTitle: "text-xs font-semibold text-gray-700 mb-1", tableCell: "px-1 py-0.5 text-xs print:text-[7pt]", header: "grid grid-cols-2 gap-2 items-start pb-2 mb-2 border-b print:pb-1 print:mb-1", companyLogoHeight: "max-h-12 print:max-h-8" };
      case 'blueprint': return { ...base, page: cn(base.page, "bg-blue-50/50 border border-blue-200 font-mono"), mainTitle: "text-2xl font-bold text-blue-700 uppercase", sectionTitle: "text-sm font-semibold text-blue-600 border-b-2 border-blue-200 pb-1 mb-2", tableHeader: "bg-blue-200/50 text-blue-800", tableCell: "px-2 py-1.5 text-sm border-blue-100" };
      case 'elegant': return { ...base, page: cn(base.page, "font-serif"), mainTitle: "text-3xl font-light tracking-wider text-gray-700", header: "flex justify-between items-center pb-6 mb-6", sectionTitle: "text-sm font-normal uppercase tracking-widest text-gray-500 border-b pb-2 mb-3", tableHeader: "bg-transparent border-b-2 border-t-2 border-gray-200", tableCell: "py-3 px-2" };
      default: return base;
    }
  }, [selectedLayout]);

  if (!estimate) {
    return <div className="p-8 text-center text-red-500">Estimate data is missing.</div>;
  }

  return (
    <div className={cn(styles.page, "relative overflow-hidden")}>
      {addWatermark && (
        <div className={cn(styles.watermarkContainer, styles.watermarkOpacity, "-z-0")}>
          {Array(16).fill(0).map((_, i) => (
            <p key={i} className={cn(styles.watermarkText)} style={{ WebkitTextStroke: '1px rgba(0,0,0,0.02)', letterSpacing: '0.05em' }}>
              {estimate.companyName || "COMPANY NAME"}
            </p>
          ))}
        </div>
      )}
      <div className="relative z-10">
        <header id="estimate-print-header-content" className={styles.header}>
          <div>
            {estimate.companyLogoUrl && (estimate.companyLogoUrl.startsWith('data:image') || estimate.companyLogoUrl.startsWith('http')) ? (
              <Image src={estimate.companyLogoUrl} alt={`${estimate.companyName || 'Company'} Logo`} width={120} height={60} className={cn("object-contain w-auto mb-2", styles.companyLogoHeight)} data-ai-hint="company logo"/>
            ) : ( <div className={cn("bg-gray-200 flex items-center justify-center text-gray-500 mb-2 text-xs rounded border border-gray-300 h-12 w-24")} data-ai-hint="logo placeholder">Logo</div> )}
            <h1 className="text-lg font-bold text-gray-800">{estimate.companyName || "Your Company Name"}</h1>
            {estimate.companyAddress && <p className="text-xs text-gray-600 whitespace-pre-line">{estimate.companyAddress}</p>}
            {estimate.companyGstin && <p className="text-xs text-gray-600">GSTIN: {estimate.companyGstin}</p>}
          </div>
          <div className="text-right">
            <h2 className={styles.mainTitle}>Estimate</h2>
            <p className="text-md text-gray-700 mt-1"># {estimate.estimateNumber}</p>
            <div className="mt-2 text-xs text-gray-600">
              <p><span className="font-semibold">Date:</span> {formatDate(estimate.date)}</p>
              {!hideValidUntil && estimate.validUntil && (<p><span className="font-semibold">Valid Until:</span> {formatDate(estimate.validUntil)}</p>)}
            </div>
          </div>
        </header>
        <section className="flex flex-col md:flex-row gap-4 mb-4 pb-4 border-b">
          <div className="flex-1 min-w-0">
            <h3 className={styles.sectionTitle}>Estimate For:</h3>
            <p className="font-bold text-gray-800">{estimate.organizationName}</p>
            {estimate.organizationAddress && <p className="text-xs text-gray-600 whitespace-pre-line">{estimate.organizationAddress}</p>}
            {estimate.organizationGstin && <p className="text-xs text-gray-600">GSTIN: {estimate.organizationGstin}</p>}
          </div>
          {estimate.subjectOfWork && (
            <div className="flex-1 min-w-0">
               <h3 className={styles.sectionTitle}>Subject:</h3>
               <p className="text-sm text-gray-700">{estimate.subjectOfWork}</p>
            </div>
          )}
        </section>
        <section className="mb-4 min-h-[300px]">
          <Table>
            <TableHeader>
              <TableRow className={styles.tableHeader}>
                <TableHead className="w-[50%]">Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimate.items.map((item, index) => (
                <TableRow key={item.id || index} className="page-break-inside-avoid"><TableCell className={cn(styles.tableCell, "font-medium whitespace-pre-wrap")}>{item.description}</TableCell><TableCell className={cn(styles.tableCell, "text-right")}>{item.quantity}</TableCell><TableCell className={cn(styles.tableCell, "text-right")}>{item.unit}</TableCell><TableCell className={cn(styles.tableCell, "text-right")}>{formatCurrency(item.rate)}</TableCell><TableCell className={cn(styles.tableCell, "text-right font-semibold")}>{formatCurrency(item.amount)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section className="flex justify-end mb-4 page-break-inside-avoid">
          <div className="w-full md:w-2/5 lg:w-1/3 text-sm">
            <div className="flex justify-between py-1.5 border-b"><span>Subtotal:</span> <span className="font-medium">{formatCurrency(estimate.subTotal)}</span></div>
            {(estimate.taxRate != null && estimate.taxRate > 0) && (<div className="flex justify-between py-1.5 border-b"><span>Tax ({estimate.taxRate}%):</span> <span className="font-medium">{formatCurrency(estimate.taxAmount)}</span></div>)}
            <div className="flex justify-between py-2 text-md font-bold bg-secondary/50 px-2 rounded-sm"><span className="uppercase text-primary">Grand Total:</span> <span>{formatCurrency(estimate.grandTotal)}</span></div>
          </div>
        </section>
        <footer className="mt-6 pt-4 border-t text-xs text-gray-600 space-y-4">
          <div className="flex flex-row gap-4 w-full">
            {(showMyContactDetails && userProfile) && (
              <div className="flex-1">
                <h4 className="font-semibold mb-1 text-gray-700">Prepared By:</h4>
                {userProfile.fullName && <p>{userProfile.fullName}</p>}
                {userProfile.email && <p>{userProfile.email}</p>}
                {userProfile.phoneNumber && <p>{userProfile.phoneNumber}</p>}
              </div>
            )}
            {estimate.notes && <div className="flex-1"><h4 className="font-semibold mb-1 text-gray-700">Notes:</h4><p className="whitespace-pre-wrap">{estimate.notes}</p></div>}
          </div>
          {estimate.termsAndConditions && <div className="mt-4"><h4 className="font-semibold mb-1 text-gray-700">Terms & Conditions:</h4><p className="whitespace-pre-wrap">{estimate.termsAndConditions}</p></div>}
          {showBankDetails && (
            <div>
              <h4 className="font-semibold mb-1 text-gray-700">Bank Account Details:</h4>
              {isLoadingBankAccount ? <Skeleton className="h-10 w-full" /> : bankAccount ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <p><strong>Holder:</strong> {bankAccount.accountHolderName}</p>
                  <p><strong>Bank:</strong> {bankAccount.bankName}</p>
                  <p><strong>A/C No:</strong> {bankAccount.accountNumber}</p>
                  <p><strong>IFSC:</strong> {bankAccount.ifscCode}</p>
                </div>
              ) : <p className="italic text-gray-500">Default bank account details not configured.</p>}
            </div>
          )}
           {showSignatureArea && (
            <div className="signature-section pt-12 page-break-inside-avoid">
              <div className="flex justify-between items-end">
                <div className="w-2/5 text-center">
                  <div className="min-h-[50px] mb-1 flex items-center justify-center relative">
                    <DigitalFingerprint
                        phrase1={userProfile?.signaturePhrase1}
                        phrase2={userProfile?.signaturePhrase2}
                        enabled={addDigitalSignature}
                    />
                    {addDigitalSignature && userProfile?.eSignature ? (
                      <Image src={userProfile.eSignature} alt="E-Signature" width={120} height={50} className="mx-auto h-[50px] object-contain relative" data-ai-hint="signature image"/>
                    ) : addDigitalSignature && userProfile?.fullName ? (
                      <p className="font-serif italic text-2xl h-[50px] flex items-center justify-center relative">{userProfile.fullName}</p>
                    ) : (
                      <div className="h-[50px]"></div>
                    )}
                  </div>
                   {addDigitalSignature && userProfile && (
                      <div className="text-[8pt] text-gray-500 mt-0.5">
                        <p>Digitally signed by: {userProfile?.fullName || userProfile?.email}</p>
                        <p>Date: {new Date().toLocaleString()}</p>
                      </div>
                  )}
                  <div className="border-t border-gray-400 pt-1 mt-1">
                    <p className="font-semibold">{estimate.companyName}</p>
                    <p>(Authorized Signature)</p>
                  </div>
                </div>
                <div className="w-2/5 text-center">
                   <div className="min-h-[50px] mb-1"></div>
                   <div className="border-t border-gray-400 pt-1 mt-1">
                      <p className="font-semibold">{estimate.organizationName}</p>
                      <p>(Client Signature)</p>
                   </div>
                </div>
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
