
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
import DprSummaryPrintLayout from './dpr-summary-print-layout';
import type { Company, DailyProgressReport, UserProfile } from '@/types/server-only';
import type html2pdf from 'html2pdf.js';
import { format } from 'date-fns';

interface DprSummaryPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reportData: {
    company: Company | null;
    reportData: DailyProgressReport[];
  } | null;
  dateRange: { from: Date, to: Date };
  userProfile: UserProfile | null;
}

const LAYOUT_OPTIONS = [
  { id: 'default', name: 'Default Professional' },
];

export default function DprSummaryPrintModal({ isOpen, onOpenChange, reportData, dateRange, userProfile }: DprSummaryPrintModalProps) {
  const [addWatermark, setAddWatermark] = useState(false);
  const [showSignatureArea, setShowSignatureArea] = useState(false);
  const [addDigitalSignature, setAddDigitalSignature] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');
  
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
  
  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-dpr-summary-content-desktop') ?? document.getElementById('printable-dpr-summary-content-mobile');
    if (!element || !reportData?.company) {
      toast({ title: "Download Error", description: "Could not find the report content to download.", variant: "destructive" });
      return;
    }

    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait, this may take a moment." });

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const companyName = reportData.company.name || 'DPR_Summary';
      const dateStr = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : 'report';
      
      const opt = {
        margin: [5, 5, 5, 5],
        filename: `${companyName}_DPR_Summary_${dateStr}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const clonedElement = element.cloneNode(true) as HTMLElement;
      document.body.appendChild(clonedElement);

      await html2pdf().from(clonedElement).set(opt).save();

      document.body.removeChild(clonedElement);
      toast({ title: "Download Started", description: "Your DPR Summary PDF is downloading." });
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({ title: "Download Failed", description: "An error occurred while generating the PDF.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };


  if (!reportData) return null;
  
  const OptionsPanel = () => (
     <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2 text-md flex items-center"><PenLine className="mr-2 h-4 w-4 text-primary" /> Print Options</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center space-x-2"><Checkbox id="addDprSummaryWatermark" checked={addWatermark} onCheckedChange={(checked) => setAddWatermark(Boolean(checked))} /><Label htmlFor="addDprSummaryWatermark" className="font-normal cursor-pointer text-xs">Add Company Watermark</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="showDprSummarySignatureArea" checked={showSignatureArea} onCheckedChange={(checked) => { const isChecked = Boolean(checked); setShowSignatureArea(isChecked); if (!isChecked) setAddDigitalSignature(false);}}/><Label htmlFor="showDprSummarySignatureArea" className="font-normal cursor-pointer text-xs">Show Signature Area</Label></div>
            <div className="flex items-center space-x-2 pl-4"><Checkbox id="addDprSummaryDigitalSignature" checked={addDigitalSignature} onCheckedChange={(checked) => setAddDigitalSignature(Boolean(checked))} disabled={!showSignatureArea}/><Label htmlFor="addDprSummaryDigitalSignature" className="font-normal cursor-pointer text-xs">Add My Digital Signature</Label></div>
          </div>
        </div>
      </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden p-4 sm:p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> DPR Summary Preview & Download</DialogTitle>
          <DialogDescription>
            Customize your report layout and content before downloading.
          </DialogDescription>
        </DialogHeader>

        <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col">
          {mobileView === 'options' ? (
            <div className="flex flex-col flex-grow">
                <div className="flex-grow">
                    <OptionsPanel />
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <DialogClose asChild><Button variant="outline" className="w-full">Cancel</Button></DialogClose>
                    <Button onClick={() => setMobileView('preview')} className="w-full">
                        <Eye className="mr-2 h-4 w-4"/> Preview Report
                    </Button>
                </div>
            </div>
          ) : (
             <>
              <div id="printable-dpr-summary-content-mobile" className="flex-1 overflow-auto -mx-4 -my-4 bg-gray-50 p-2">
                <DprSummaryPrintLayout
                    key={previewKey}
                    {...reportData}
                    dateRange={dateRange}
                    isLoading={false}
                    userProfile={userProfile}
                    addWatermark={addWatermark}
                    showSignatureArea={showSignatureArea}
                    addDigitalSignature={addDigitalSignature}
                />
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading}>{isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}</Button>
              </DialogFooter>
            </>
          )}
        </div>

        <div className="hidden md:grid grid-cols-[280px_1fr] flex-1 overflow-hidden px-6 pb-6">
          <div className="flex flex-col space-y-4 overflow-y-auto border-r pr-4">
            <OptionsPanel />
          </div>
          <div className="flex-1 p-2 bg-gray-50 overflow-y-auto border rounded-md shadow-inner">
            <div id="printable-dpr-summary-content-desktop" className="mx-auto w-[210mm] min-h-[297mm]">
               <DprSummaryPrintLayout
                    key={previewKey}
                    {...reportData}
                    dateRange={dateRange}
                    isLoading={false}
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
          <Button type="button" onClick={handleDownloadPdf} disabled={isDownloading}>
            {isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
