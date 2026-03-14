
'use client';

import type { PurchaseOrder } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { cn, formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { DigitalFingerprint } from '@/components/auth/digital-fingerprint';

interface PurchaseOrderPrintLayoutProps {
  purchaseOrder: PurchaseOrder;
  selectedLayout?: string;
  addWatermark?: boolean;
  showSignatureArea?: boolean;
  addDigitalSignature?: boolean;
}

export default function PurchaseOrderPrintLayout({
  purchaseOrder,
  selectedLayout = 'default',
  addWatermark = false,
  showSignatureArea = false,
  addDigitalSignature = false,
}: PurchaseOrderPrintLayoutProps) {
  const { userProfile } = useAuth();
  
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
      page: "bg-white p-4 sm:p-6 print:p-0 po-print-content relative min-h-[700px] print:min-h-0",
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

  if (!purchaseOrder) {
    return <div className="p-8 text-center text-red-500">Purchase Order data is missing.</div>;
  }
  
  return (
    <div className={cn(styles.page, "relative overflow-hidden")}>
      {addWatermark && (
        <div className={cn(styles.watermarkContainer, styles.watermarkOpacity, "-z-0")}>
          {Array(16).fill(0).map((_, i) => (
            <p key={i} className={cn(styles.watermarkText)} style={{ WebkitTextStroke: '1px rgba(0,0,0,0.02)', letterSpacing: '0.05em' }}>
              {purchaseOrder.companyName || "COMPANY NAME"}
            </p>
          ))}
        </div>
      )}
      <div className="relative z-10">
        <header id="po-print-header-content" className={styles.header}>
          <div>
            {purchaseOrder.company?.logoUrl && (purchaseOrder.company.logoUrl.startsWith('data:image') || purchaseOrder.company.logoUrl.startsWith('http')) ? (
              <Image src={purchaseOrder.company.logoUrl} alt={`${purchaseOrder.companyName || 'Company'} Logo`} width={120} height={60} className={cn("object-contain w-auto mb-2", styles.companyLogoHeight)} data-ai-hint="company logo"/>
            ) : ( <div className={cn("bg-gray-200 flex items-center justify-center text-gray-500 mb-2 text-xs rounded border border-gray-300 h-12 w-24")} data-ai-hint="logo placeholder">Logo</div> )}
            <h1 className="text-lg font-bold text-gray-800">{purchaseOrder.companyName || "Your Company Name"}</h1>
            {purchaseOrder.companyAddress && <p className="text-xs text-gray-600 whitespace-pre-line">{purchaseOrder.companyAddress}</p>}
            {purchaseOrder.company?.gstin && <p className="text-xs text-gray-600">GSTIN: {purchaseOrder.company.gstin}</p>}
          </div>
          <div className="text-right">
            <h2 className={styles.mainTitle}>Purchase Order</h2>
            <p className="text-md text-gray-700 mt-1"># {purchaseOrder.poNumber}</p>
            <div className="mt-2 text-xs text-gray-600">
              <p><span className="font-semibold">Date:</span> {formatDate(purchaseOrder.date)}</p>
            </div>
          </div>
        </header>
        <section className="flex flex-col md:flex-row gap-4 mb-4 pb-4 border-b">
          <div className="flex-1 min-w-0">
            <h3 className={styles.sectionTitle}>Vendor/Supplier:</h3>
            <p className="font-bold text-gray-800">{purchaseOrder.supplierOrganizationName}</p>
            {purchaseOrder.supplierOrganization?.address && <p className="text-xs text-gray-600 whitespace-pre-line">{purchaseOrder.supplierOrganization.address}</p>}
            {purchaseOrder.supplierOrganization?.gstin && <p className="text-xs text-gray-600">GSTIN: {purchaseOrder.supplierOrganization.gstin}</p>}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={styles.sectionTitle}>Ship To:</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{purchaseOrder.shippingAddress || 'Not Specified'}</p>
          </div>
        </section>
        <section className="mb-4 min-h-[300px]">
          <Table>
            <TableHeader>
              <TableRow className={styles.tableHeader}>
                <TableHead className="w-[50%]">Item / Service Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.items.map((item, index) => (
                <TableRow key={item.id || index} className="page-break-inside-avoid"><TableCell className={cn(styles.tableCell, "font-medium whitespace-pre-wrap")}>{item.description}</TableCell><TableCell className={cn(styles.tableCell, "text-right")}>{item.quantity}</TableCell><TableCell className={cn(styles.tableCell, "text-right")}>{item.unit}</TableCell><TableCell className={cn(styles.tableCell, "text-right")}>{formatCurrency(item.rate)}</TableCell><TableCell className={cn(styles.tableCell, "text-right font-semibold")}>{formatCurrency(item.amount)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section className="flex justify-end mb-4 page-break-inside-avoid">
          <div className="w-full md:w-2/5 lg:w-1/3 text-sm">
            <div className="flex justify-between py-1.5 border-b"><span>Subtotal:</span> <span className="font-medium">{formatCurrency(purchaseOrder.subTotal)}</span></div>
            {(purchaseOrder.taxRate != null && purchaseOrder.taxRate > 0) && <div className="flex justify-between py-1.5 border-b"><span>Tax ({purchaseOrder.taxRate}%):</span> <span className="font-medium">{formatCurrency(purchaseOrder.taxAmount)}</span></div>}
            <div className="flex justify-between py-2 text-md font-bold bg-secondary/50 px-2 rounded-sm"><span className="uppercase text-primary">Grand Total:</span> <span>{formatCurrency(purchaseOrder.grandTotal)}</span></div>
          </div>
        </section>
        <footer className="mt-6 pt-4 border-t text-xs text-gray-600 space-y-4">
          <div className="flex flex-row gap-4 w-full">
            {purchaseOrder.billingAddress && <div className="flex-1"><h4 className="font-semibold mb-1 text-gray-700">Billing Address:</h4><p className="whitespace-pre-wrap">{purchaseOrder.billingAddress}</p></div>}
            {purchaseOrder.paymentTerms && <div className="flex-1"><h4 className="font-semibold mb-1 text-gray-700">Payment Terms:</h4><p className="whitespace-pre-wrap">{purchaseOrder.paymentTerms}</p></div>}
            {purchaseOrder.notes && <div className="flex-1"><h4 className="font-semibold mb-1 text-gray-700">Notes:</h4><p className="whitespace-pre-wrap">{purchaseOrder.notes}</p></div>}
          </div>
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
                  {addDigitalSignature && (
                      <div className="text-[8pt] text-gray-500 mt-0.5">
                        <p>Digitally signed by: {userProfile?.fullName || userProfile?.email}</p>
                        <p>Date: {new Date().toLocaleString()}</p>
                      </div>
                  )}
                  <div className="border-t border-gray-400 pt-1 mt-1">
                    <p className="font-semibold">{purchaseOrder.companyName}</p>
                    <p>(Authorized Signature)</p>
                  </div>
                </div>
                <div className="w-2/5 text-center">
                   <div className="min-h-[50px] mb-1"></div>
                   <div className="border-t border-gray-400 pt-1 mt-1">
                      <p className="font-semibold">{purchaseOrder.supplierOrganizationName}</p>
                      <p>(Supplier Signature)</p>
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
