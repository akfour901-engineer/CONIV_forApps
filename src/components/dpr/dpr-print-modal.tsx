
'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Printer, X, Download, Loader2, PenLine, Eye, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DprPrintLayout from './dpr-print-layout';
import type { Company, DailyProgressReport, UserProfile, WorkOrder } from '@/types/server-only';
import { useAuth } from '@/hooks/use-auth';
import type html2pdf from 'html2pdf.js';
import { Skeleton } from '../ui/skeleton';

interface DprPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  report: DailyProgressReport | null;
}

export default function DprPrintModal({ isOpen, onOpenChange, report }: DprPrintModalProps) {
  const { userProfile, user } = useAuth();
  const [addWatermark, setAddWatermark] = useState(false);
  const [showSignatureArea, setShowSignatureArea] = useState(false);
  const [addDigitalSignature, setAddDigitalSignature] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');
  const [company, setCompany] = useState<Company | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAddWatermark(false);
      setShowSignatureArea(false);
      setAddDigitalSignature(false);
      setMobileView('options');
    }
  }, [isOpen]);

  useEffect(() => {
    setPreviewKey(Date.now());
  }, [addWatermark, showSignatureArea, addDigitalSignature]);

  useEffect(() => {
    if (isOpen && report && user) {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const idToken = await user.getIdToken();
                if (!report.companyId) {
                  throw new Error("Company ID is missing in the DPR.");
                }
                const [woResponse, compResponse] = await Promise.all([
                    fetch(`/api/work-orders/${report.workOrderId}`, { headers: { 'Authorization': `Bearer ${idToken}` }}),
                    fetch(`/api/companies/${report.companyId}`, { headers: { 'Authorization': `Bearer ${idToken}` }})
                ]);
                if(woResponse.ok) setWorkOrder(await woResponse.json());
                if(compResponse.ok) setCompany(await compResponse.json());
            } catch (error) {
                console.error("Error fetching print data:", error);
                toast({title: "Error", description: "Failed to load associated data for printing."});
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }
  }, [isOpen, report, user, toast]);
  
  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-dpr-content-desktop') ?? document.getElementById('printable-dpr-content-mobile');
    if (!element) {
      toast({ title: "Download Error", description: "Could not find the report content to download.", variant: "destructive" });
      return;
    }
    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait, this may take a moment." });

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0,
        filename: `DPR_${report?.workOrderNumber}_${report?.reportDate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      const pdf = await html2pdf().from(element).set(opt).toPdf().get('pdf');
      const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
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
      await pdf.save();

      toast({ title: "Download Started", description: "Your DPR PDF is downloading." });
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({ title: "Download Failed", description: "An error occurred while generating the PDF.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };
  
  if (!report) return null;
  
  const OptionsPanel = () => (
     <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2 text-md flex items-center"><PenLine className="mr-2 h-4 w-4 text-primary" /> Print Options</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center space-x-2"><Checkbox id="addDprWatermark" checked={addWatermark} onCheckedChange={(checked) => setAddWatermark(Boolean(checked))} /><Label htmlFor="addDprWatermark" className="font-normal cursor-pointer text-xs">Add Company Watermark</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="showDprSignatureArea" checked={showSignatureArea} onCheckedChange={(checked) => { const isChecked = Boolean(checked); setShowSignatureArea(isChecked); if (!isChecked) setAddDigitalSignature(false);}}/><Label htmlFor="showDprSignatureArea" className="font-normal cursor-pointer text-xs">Show Signature Area</Label></div>
            <div className="flex items-center space-x-2 pl-4"><Checkbox id="addDprDigitalSignature" checked={addDigitalSignature} onCheckedChange={(checked) => setAddDigitalSignature(Boolean(checked))} disabled={!showSignatureArea}/><Label htmlFor="addDprDigitalSignature" className="font-normal cursor-pointer text-xs">Add My Digital Signature</Label></div>
          </div>
        </div>
      </div>
  );

  const ReportContent = () => (
    <DprPrintLayout
      key={previewKey}
      report={report}
      company={company}
      workOrder={workOrder}
      addWatermark={addWatermark}
      showSignatureArea={showSignatureArea}
      addDigitalSignature={addDigitalSignature}
      isLoading={isLoading}
      userProfile={userProfile}
    />
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden p-4 sm:p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> DPR Preview & Download</DialogTitle>
        </DialogHeader>

        <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col">
          {mobileView === 'options' ? (
            <div className="flex flex-col flex-grow">
                <div className="flex-grow"><OptionsPanel /></div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <DialogClose asChild><Button variant="outline" className="w-full">Cancel</Button></DialogClose>
                    <Button onClick={() => setMobileView('preview')} className="w-full"><Eye className="mr-2 h-4 w-4"/> Preview</Button>
                </div>
            </div>
          ) : (
             <>
              <div id="printable-dpr-content-mobile" className="flex-1 overflow-auto -mx-4 -my-4 bg-gray-50 p-2">
                <ReportContent />
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading || isLoading}>{isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download</>}</Button>
              </DialogFooter>
            </>
          )}
        </div>
        <div className="hidden md:grid grid-cols-[280px_1fr] flex-1 overflow-hidden px-6 pb-6">
          <div className="flex flex-col space-y-4 overflow-y-auto border-r pr-4"><OptionsPanel /></div>
          <div className="flex-1 p-2 bg-gray-50 overflow-auto border rounded-md shadow-inner">
            <div id="printable-dpr-content-desktop" className="mx-auto w-[210mm] min-h-[297mm] print:min-h-0">
               <ReportContent />
            </div>
          </div>
        </div>
        <DialogFooter className="hidden md:flex sm:justify-end gap-2 p-6 pt-4 border-t shrink-0">
          <DialogClose asChild><Button type="button" variant="outline"><X className="mr-2 h-4 w-4" /> Close</Button></DialogClose>
          <Button type="button" onClick={handleDownloadPdf} disabled={isDownloading || isLoading}>
            {isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
      