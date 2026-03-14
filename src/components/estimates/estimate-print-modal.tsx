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
import type { Estimate, UserProfile } from '@/types';
import EstimatePrintLayout from './estimate-print-layout';
import { Download, X, LayoutTemplate, PenLine, Printer, Eye, ArrowLeft, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import type html2pdf from 'html2pdf.js';

interface EstimatePrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: Estimate | null;
}

const LAYOUT_OPTIONS = [
  { id: 'default', name: 'Default Professional' },
  { id: 'modern-minimal', name: 'Modern Minimal' },
  { id: 'classic-formal', name: 'Classic Formal' },
  { id: 'invoice-style', name: 'Invoice Style' },
  { id: 'sleek', name: 'Sleek Header' },
  { id: 'compact', name: 'Compact' },
  { id: 'blueprint', name: 'Blueprint' },
  { id: 'elegant', name: 'Elegant' },
];

export default function EstimatePrintModal({ isOpen, onOpenChange, estimate }: EstimatePrintModalProps) {
  const { userProfile } = useAuth();
  const [selectedLayout, setSelectedLayout] = useState('default');
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showMyContactDetails, setShowMyContactDetails] = useState(true);
  const [addWatermark, setAddWatermark] = useState(false);
  const [showSignatureArea, setShowSignatureArea] = useState(true);
  const [addDigitalSignature, setAddDigitalSignature] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');
  const [isLoadingBankAccount, setIsLoadingBankAccount] = useState(false);

  useEffect(() => {
    if (isOpen && estimate) {
      setSelectedLayout('default');
      setShowBankDetails(false);
      setShowMyContactDetails(true);
      setAddWatermark(false);
      setShowSignatureArea(true);
      setAddDigitalSignature(false);
      setMobileView('options');
    }
  }, [isOpen, estimate]);

  useEffect(() => {
    setPreviewKey(Date.now());
  }, [selectedLayout, showBankDetails, showMyContactDetails, addWatermark, showSignatureArea, addDigitalSignature]);


  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-estimate-content-desktop') ?? document.getElementById('printable-estimate-content-mobile');

    if (!element) {
        toast({ title: "Download Error", description: "Cannot find content to download.", variant: "destructive" });
        return;
    }

    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait, this may take a moment." });

    try {
        const html2pdf = (await import('html2pdf.js')).default;

        const clonedElement = element.cloneNode(true) as HTMLElement;
        document.body.appendChild(clonedElement);
        
        const opt = {
            margin: 0,
            filename: `estimate-${estimate?.estimateNumber || 'download'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().from(clonedElement).set(opt).toPdf().get('pdf').save();

        document.body.removeChild(clonedElement);
        toast({ title: "Download Started", description: "Your estimate PDF is downloading." });
    } catch (error) {
        console.error("PDF generation error:", error);
        toast({ title: "Download Failed", description: "An error occurred while generating the PDF.", variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };


  if (!estimate) return null;

  const OptionsPanel = () => (
     <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-1.5 text-md flex items-center"><LayoutTemplate className="mr-2 h-4 w-4 text-primary" /> Layout Style</h3>
          <div className="grid grid-cols-2 gap-2">
            {LAYOUT_OPTIONS.map(layout => (
                <Button
                key={layout.id}
                variant={selectedLayout === layout.id ? 'default' : 'outline'}
                className="w-full justify-start text-xs h-8 px-2"
                onClick={() => setSelectedLayout(layout.id)}
                >
                {layout.name}
                </Button>
            ))}
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-2 text-md flex items-center"><PenLine className="mr-2 h-4 w-4 text-primary" /> Content Options</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center space-x-2"><Checkbox id="showEstimateMyContactDetailsModal" checked={showMyContactDetails} onCheckedChange={(checked) => setShowMyContactDetails(Boolean(checked))} /><Label htmlFor="showEstimateMyContactDetailsModal" className="font-normal cursor-pointer text-xs">Show My Contact Details</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="showEstimateBankDetailsModal" checked={showBankDetails} onCheckedChange={(checked) => setShowBankDetails(Boolean(checked))} /><Label htmlFor="showEstimateBankDetailsModal" className="font-normal cursor-pointer text-xs">Include Bank Account</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="addEstimateWatermarkModal" checked={addWatermark} onCheckedChange={(checked) => setAddWatermark(Boolean(checked))} /><Label htmlFor="addEstimateWatermarkModal" className="font-normal cursor-pointer text-xs">Add Company Watermark</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="showEstimateSignatureAreaModal" checked={showSignatureArea} onCheckedChange={(checked) => { const isChecked = Boolean(checked); setShowSignatureArea(isChecked); if (!isChecked) setAddDigitalSignature(false);}}/><Label htmlFor="showEstimateSignatureAreaModal" className="font-normal cursor-pointer text-xs">Show Signature Area</Label></div>
            <div className="flex items-center space-x-2 pl-4"><Checkbox id="addEstimateDigitalSignatureModal" checked={addDigitalSignature} onCheckedChange={(checked) => setAddDigitalSignature(Boolean(checked))} disabled={!showSignatureArea}/><Label htmlFor="addEstimateDigitalSignatureModal" className="font-normal cursor-pointer text-xs">Add My Digital Signature</Label></div>
          </div>
        </div>
      </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-screen flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden p-4 sm:p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> Estimate Preview & Download</DialogTitle>
          <DialogDescription>
            Customize your estimate layout and content before downloading.
          </DialogDescription>
        </DialogHeader>

        {/* Mobile View */}
        <div className="md:hidden flex-1 overflow-hidden p-4 flex flex-col">
          {mobileView === 'options' ? (
            <div className="flex flex-col flex-grow">
                <div className="flex-grow">
                    <OptionsPanel />
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <DialogClose asChild>
                        <Button variant="outline" className="w-full">Cancel</Button>
                    </DialogClose>
                    <Button onClick={() => setMobileView('preview')} className="w-full">
                        <Eye className="mr-2 h-4 w-4"/> Preview Estimate
                    </Button>
                </div>
            </div>
          ) : (
             <>
              <div id="printable-estimate-content-mobile" className="flex-1 overflow-auto -mx-4 -my-4 bg-gray-50 p-2">
                <EstimatePrintLayout
                  key={previewKey}
                  estimate={estimate}
                  userProfile={userProfile}
                  selectedLayout={selectedLayout}
                  showBankDetails={showBankDetails}
                  showMyContactDetails={showMyContactDetails}
                  addWatermark={addWatermark}
                  showSignatureArea={showSignatureArea}
                  addDigitalSignature={addDigitalSignature}
                  setIsLoadingBankAccount={setIsLoadingBankAccount}
                  isLoadingBankAccount={isLoadingBankAccount}
                />
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Options</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading || isLoadingBankAccount}>{isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}</Button>
              </DialogFooter>
            </>
          )}
        </div>


        {/* Desktop View */}
        <div className="hidden md:grid grid-cols-[280px_1fr] flex-1 overflow-hidden px-6 pb-6">
          <div className="flex flex-col space-y-4 overflow-y-auto border-r pr-4">
            <OptionsPanel />
          </div>
          <div className="flex-1 p-2 bg-gray-50 overflow-auto border rounded-md shadow-inner">
            <div id="printable-estimate-content-desktop" className="mx-auto w-[210mm] min-h-[297mm]">
                <EstimatePrintLayout
                  key={previewKey}
                  estimate={estimate}
                  userProfile={userProfile}
                  selectedLayout={selectedLayout}
                  showBankDetails={showBankDetails}
                  showMyContactDetails={showMyContactDetails}
                  addWatermark={addWatermark}
                  showSignatureArea={showSignatureArea}
                  addDigitalSignature={addDigitalSignature}
                  setIsLoadingBankAccount={setIsLoadingBankAccount}
                  isLoadingBankAccount={isLoadingBankAccount}
                />
            </div>
          </div>
        </div>

        <DialogFooter className="hidden md:flex sm:justify-end gap-2 p-6 pt-4 border-t shrink-0">
          <DialogClose asChild><Button type="button" variant="outline"><X className="mr-2 h-4 w-4" /> Close</Button></DialogClose>
          <Button type="button" onClick={handleDownloadPdf} disabled={isDownloading || isLoadingBankAccount}>
            {isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
