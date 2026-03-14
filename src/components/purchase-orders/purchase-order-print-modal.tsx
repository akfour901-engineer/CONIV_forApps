
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
} from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import type { PurchaseOrder } from '@/types';
import PurchaseOrderPrintLayout from './purchase-order-print-layout';
import { Download, X, LayoutTemplate, PenLine, Printer, Eye, ArrowLeft, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type html2pdf from 'html2pdf.js';


interface PurchaseOrderPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
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

export default function PurchaseOrderPrintModal({ isOpen, onOpenChange, purchaseOrder }: PurchaseOrderPrintModalProps) {
  const [selectedLayout, setSelectedLayout] = useState('default');
  const [addWatermark, setAddWatermark] = useState(false);
  const [showSignatureArea, setShowSignatureArea] = useState(true);
  const [addDigitalSignature, setAddDigitalSignature] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const [previewKey, setPreviewKey] = useState(Date.now());
  
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');


  useEffect(() => {
    if (isOpen && purchaseOrder) {
      setSelectedLayout('default');
      setAddWatermark(false);
      setShowSignatureArea(true);
      setAddDigitalSignature(false);
      setPreviewKey(Date.now());
      setMobileView('options');
    }
  }, [isOpen, purchaseOrder]);

  useEffect(() => {
    setPreviewKey(Date.now());
  }, [selectedLayout, addWatermark, showSignatureArea, addDigitalSignature]);


  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-po-content-desktop') ?? document.getElementById('printable-po-content-mobile');
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
            filename: `PO-${purchaseOrder?.poNumber || 'download'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().from(clonedElement).set(opt).toPdf().get('pdf').save();

        document.body.removeChild(clonedElement);
        toast({ title: "Download Started", description: "Your Purchase Order PDF is downloading." });
    } catch (error) {
        console.error("PDF generation error:", error);
        toast({ title: "Download Failed", description: "An error occurred while generating the PDF.", variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };


  if (!purchaseOrder) return null;

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
            <div className="flex items-center space-x-2"><Checkbox id="addPOWatermark" checked={addWatermark} onCheckedChange={(checked) => setAddWatermark(Boolean(checked))} /><Label htmlFor="addPOWatermark" className="font-normal cursor-pointer text-xs">Add Company Watermark</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="showPOSignatureArea" checked={showSignatureArea} onCheckedChange={(checked) => { const isChecked = Boolean(checked); setShowSignatureArea(isChecked); if (!isChecked) setAddDigitalSignature(false);}}/><Label htmlFor="showPOSignatureArea" className="font-normal cursor-pointer text-xs">Show Signature Area</Label></div>
            <div className="flex items-center space-x-2 pl-4"><Checkbox id="addPoDigitalSignature" checked={addDigitalSignature} onCheckedChange={(checked) => setAddDigitalSignature(Boolean(checked))} disabled={!showSignatureArea}/><Label htmlFor="addPoDigitalSignature" className="font-normal cursor-pointer text-xs">Add My Digital Signature</Label></div>
          </div>
        </div>
      </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-screen flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden p-4 sm:p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> PO Preview & Download</DialogTitle>
          <DialogDescription>
            Customize your purchase order layout and content before downloading.
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
                        <Eye className="mr-2 h-4 w-4"/> Preview PO
                    </Button>
                </div>
            </div>
          ) : (
             <>
              <div className="flex-1 overflow-auto -mx-4 -my-4 bg-gray-50 p-2">
                <div id="printable-po-content-mobile" className="mx-auto w-[210mm] min-h-[297mm] print:min-h-0">
                  <PurchaseOrderPrintLayout
                    key={previewKey}
                    purchaseOrder={purchaseOrder}
                    selectedLayout={selectedLayout}
                    addWatermark={addWatermark}
                    showSignatureArea={showSignatureArea}
                    addDigitalSignature={addDigitalSignature}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Options</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading}>{isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}</Button>
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
            <div id="printable-po-content-desktop" className="mx-auto w-[210mm] min-h-[297mm] print:min-h-0">
                <PurchaseOrderPrintLayout
                  key={previewKey}
                  purchaseOrder={purchaseOrder}
                  selectedLayout={selectedLayout}
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
