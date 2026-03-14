
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Printer, X, Download, Loader2, PenLine, Eye, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LetterPrintLayout from './letter-print-layout';
import type { Letter, Company } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import type html2pdf from 'html2pdf.js';


interface LetterPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  letter: Partial<Letter> | null;
}

const LAYOUT_OPTIONS = [
  { id: 'default', name: 'Default Professional' },
];

export default function LetterPrintModal({ isOpen, onOpenChange, letter }: LetterPrintModalProps) {
  const { user, dataOwnerId } = useAuth();
  const [addWatermark, setAddWatermark] = useState(true);
  const [showSignatureArea, setShowSignatureArea] = useState(true);
  const [addDigitalSignature, setAddDigitalSignature] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [mobileView, setMobileView] = useState<'options' | 'preview'>('options');
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);

  useEffect(() => {
    if (isOpen && letter) {
      setMobileView('options');
      const fetchCompany = async () => {
        if (user && dataOwnerId) {
          setIsLoadingCompany(true);
          try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, {
              headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (response.ok) {
              const companies: Company[] = await response.json();
              if (companies.length > 0) setCompany(companies[0]); // Default to first company
            } else {
              toast({ title: "Warning", description: "Could not fetch company details for letterhead.", variant: "destructive" });
            }
          } catch (error) {
            toast({ title: "Error", description: "Could not fetch company details.", variant: "destructive" });
          }
          setIsLoadingCompany(false);
        }
      };
      fetchCompany();
    }
  }, [isOpen, letter, user, dataOwnerId, toast]);

  useEffect(() => {
    setPreviewKey(Date.now());
  }, [addWatermark, showSignatureArea, addDigitalSignature]);
  
  const handleDownloadPdf = async () => {
    const originalElement = document.getElementById('printable-letter-content');
    if (!originalElement) {
        toast({ title: "Download Error", variant: "destructive" });
        return;
    }
    setIsDownloading(true);
    toast({ title: "Generating PDF...", description: "Please wait." });
    
    try {
        const html2pdf = (await import('html2pdf.js')).default;
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        document.body.appendChild(clonedElement);
        const opt = {
            margin: 0,
            filename: `${letter?.generatedTitle || 'document'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await html2pdf().from(clonedElement).set(opt).toPdf().get('pdf').save();
        document.body.removeChild(clonedElement);
    } catch (error) {
        toast({ title: "Download Failed", variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };


  if (!letter) return null;
  
  const OptionsPanel = () => (
     <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2 text-md flex items-center"><PenLine className="mr-2 h-4 w-4 text-primary" /> Print Options</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center space-x-2"><Checkbox id="addWatermarkLetterModal" checked={addWatermark} onCheckedChange={(checked) => setAddWatermark(Boolean(checked))} /><Label htmlFor="addWatermarkLetterModal" className="font-normal cursor-pointer text-xs">Add Company Watermark</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="showSignatureAreaLetterModal" checked={showSignatureArea} onCheckedChange={(checked) => { const isChecked = Boolean(checked); setShowSignatureArea(isChecked); if (!isChecked) setAddDigitalSignature(false);}}/><Label htmlFor="showSignatureAreaLetterModal" className="font-normal cursor-pointer text-xs">Show Signature Area</Label></div>
            <div className="flex items-center space-x-2 pl-4"><Checkbox id="addDigitalSignatureLetterModal" checked={addDigitalSignature} onCheckedChange={(checked) => setAddDigitalSignature(Boolean(checked))} disabled={!showSignatureArea}/><Label htmlFor="addDigitalSignatureLetterModal" className="font-normal cursor-pointer text-xs">Add My Digital Signature</Label></div>
          </div>
        </div>
      </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full flex flex-col p-0 print:p-0">
        <DialogHeader className="print:hidden p-4 sm:p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center"><Printer className="mr-2 h-5 w-5 text-primary" /> Document Preview & Download</DialogTitle>
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
              <div id="printable-letter-content-mobile" className="flex-1 overflow-y-auto -mx-4 -my-4 bg-gray-50 p-2">
                   <LetterPrintLayout key={previewKey} letter={letter} company={company} addWatermark={addWatermark} showSignatureArea={showSignatureArea} addDigitalSignature={addDigitalSignature} />
              </div>
              <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setMobileView('options')} className="w-full"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                <Button onClick={handleDownloadPdf} className="w-full" disabled={isDownloading || isLoadingCompany}>{isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />} Download</Button>
              </DialogFooter>
            </>
          )}
        </div>

        <div className="hidden md:grid grid-cols-[280px_1fr] flex-1 overflow-hidden px-6 pb-6">
          <div className="flex flex-col space-y-4 overflow-y-auto border-r pr-4"><OptionsPanel /></div>
          <div className="flex-1 p-2 bg-gray-50 overflow-y-auto border rounded-md shadow-inner">
            <div id="printable-letter-content" className="mx-auto w-[210mm] min-h-[297mm]">
                <LetterPrintLayout key={previewKey} letter={letter} company={company} addWatermark={addWatermark} showSignatureArea={showSignatureArea} addDigitalSignature={addDigitalSignature}/>
            </div>
          </div>
        </div>

        <DialogFooter className="hidden md:flex sm:justify-end gap-2 p-6 pt-4 border-t shrink-0">
          <DialogClose asChild><Button type="button" variant="outline"><X className="mr-2 h-4 w-4" /> Close</Button></DialogClose>
          <Button type="button" onClick={handleDownloadPdf} disabled={isDownloading || isLoadingCompany}>
            {isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading...</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
