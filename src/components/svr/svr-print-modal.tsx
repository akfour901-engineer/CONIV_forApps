
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Printer, X, Download, Loader2, PenLine, Eye, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SvrPrintLayout from './svr-print-layout';
import type { ServiceVisitReport, Company, WorkOrder, UserProfile } from '@/types/server-only';
import { useAuth } from '@/hooks/use-auth';
import type html2pdf from 'html2pdf.js';


interface SvrPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  report: ServiceVisitReport | null;
}

export default function SvrPrintModal({ isOpen, onOpenChange, report }: SvrPrintModalProps) {
  const { user, userProfile } = useAuth();
  const [addWatermark, setAddWatermark] = useState(false);
  const [showSignatureArea, setShowSignatureArea] = useState(true);
  const [addDigitalSignature, setAddDigitalSignature] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');
  const [company, setCompany] = useState<Company | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  useEffect(() => {
    if (isOpen && report && user) {
      setMobileView('options');
      const fetchDetails = async () => {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/reports/svr/${report.id}/details`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error('Failed to fetch details');
          const data = await response.json();
          setCompany(data.company);
          setWorkOrder(data.workOrder);
        } catch (error) {
          toast({ title: "Error", description: "Could not fetch company or work order details for printing.", variant: "destructive" });
        }
        setIsLoading(false);
      };
      fetchDetails();
    }
  }, [isOpen, report, user, toast]);

  useEffect(() => {
    setPreviewKey(Date.now());
  }, [addWatermark, showSignatureArea, addDigitalSignature]);
  
  const handleDownloadPdf = async () => {
    const originalElement = document.getElementById('printable-svr-content');
    if (!originalElement) {
        toast({ title: "Download Error", description: "Cannot find content to download.", variant: "destructive" });
        return;
    }

    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait, this may take a moment." });

    try {
        const html2pdf = (await import('html2pdf.js')).default;
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        document.body.appendChild(clonedElement);
        
        const opt = {
            margin: 0,
            filename: `SVR-${report?.workOrderNumber}-${report?.visitDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().from(clonedElement).set(opt).toPdf().get('pdf').save();

        document.body.removeChild(clonedElement);
        toast({ title: "Download Started", description: "Your SVR PDF is downloading." });
    } catch (error) {
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
            <div className="flex items-center space-x-2"><Checkbox id="addSvrWatermarkModal" checked={addWatermark} onCheckedChange={(checked) => setAddWatermark(Boolean(checked))} /><Label htmlFor="addSvrWatermarkModal" className="font-normal cursor-pointer text-xs">Add Company Watermark</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="showSvrSignatureAreaModal" checked={showSignatureArea} onCheckedChange={(checked) => { const isChecked = Boolean(checked); setShowSignatureArea(isChecked); if (!isChecked) setAddDigitalSignature(false);}}/><Label htmlFor="showSvrSignatureAreaModal" className="font-normal cursor-pointer text-xs">Show Signature Area</Label></div>
            <div className="flex items-center space-x-2 pl-4"><Checkbox id="addSvrDigitalSignatureModal" checked={addDigitalSignature} onCheckedChange={(checked) => setAddDigitalSignature(Boolean(checked))} disabled={!showSignatureArea}/><Label htmlFor="addSvrDigitalSignatureModal" className="font-normal cursor-pointer text-xs">Add My Digital Signature</Label></div>
          </div>
        </div>
      </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-screen flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden p-4 sm:p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> SVR Preview & Download</DialogTitle>
          <DialogDescription>
            Customize your Service Visit Report layout and content before downloading.
          </DialogDescription>
        </DialogHeader>

        {/* Mobile View */}
        <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col">
          {mobileView === 'options' ? (
            <div className="flex flex-col flex-grow">
                <div className="flex-grow">
                    <OptionsPanel />
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <DialogClose asChild><Button variant="outline" className="w-full">Cancel</Button></DialogClose>
                    <Button onClick={() => setMobileView('preview')} className="w-full" disabled={isLoading}>
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading...</> : <><Eye className="mr-2 h-4 w-4"/> Preview</>}
                    </Button>
                </div>
            </div>
          ) : (
             <>
              <div id="printable-svr-content-mobile" className="flex-1 overflow-y-auto -mx-4 -my-4 bg-gray-50 p-2">
                   <SvrPrintLayout
                      key={previewKey}
                      report={report}
                      company={company}
                      workOrder={workOrder}
                      userProfile={userProfile}
                      addWatermark={addWatermark}
                      showSignatureArea={showSignatureArea}
                      addDigitalSignature={addDigitalSignature}
                    />
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading || isLoading}>{isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}</Button>
              </DialogFooter>
            </>
          )}
        </div>


        {/* Desktop View */}
        <div className="hidden md:grid grid-cols-[280px_1fr] flex-1 overflow-hidden px-6 pb-6">
          <div className="flex flex-col space-y-4 overflow-y-auto border-r pr-4">
            <OptionsPanel />
          </div>
          <div className="flex-1 p-2 bg-gray-50 overflow-y-auto border rounded-md shadow-inner">
            <div id="printable-svr-content" className="mx-auto w-[210mm] min-h-[297mm] print:min-h-0">
                <SvrPrintLayout
                  key={previewKey}
                  report={report}
                  company={company}
                  workOrder={workOrder}
                  userProfile={userProfile}
                  addWatermark={addWatermark}
                  showSignatureArea={showSignatureArea}
                  addDigitalSignature={addDigitalSignature}
                />
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
