
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, PurchaseOrder } from '@/types';
import { Save, Loader2, X, Info, ExternalLink, UploadCloud, DownloadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from '../ui/alert';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const MAX_FILE_SIZE_MB = 0.75; // 750KB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const proofFormSchema = z.object({
  awardProofUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.4, { message: "File data is too large." }).optional().nullable(),
  awardProofLink: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (!data.awardProofUrl && !data.awardProofLink) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please either upload a file or enter a URL.",
      path: ["awardProofUrl"],
    });
  }
});


type ProofFormValues = z.infer<typeof proofFormSchema>;

interface AwardProofModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  document: WorkOrder | PurchaseOrder | null;
  onDocumentUpdated: () => void;
  documentType: 'work-order' | 'purchase-order';
}

export default function AwardProofModal({
  isOpen,
  onOpenChange,
  document,
  onDocumentUpdated,
  documentType,
}: AwardProofModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  
  const form = useForm<ProofFormValues>({
    resolver: zodResolver(proofFormSchema),
    mode: 'onChange',
    defaultValues: { awardProofUrl: "", awardProofLink: "" },
  });

  useEffect(() => {
    if (document && isOpen) {
      const isUrl = document.awardProofUrl?.startsWith('http');
      form.reset({ 
        awardProofUrl: isUrl ? '' : document.awardProofUrl || "",
        awardProofLink: isUrl ? document.awardProofUrl || "" : "",
      });
      setSelectedFileName(isUrl ? null : document.awardProofUrl ? "Existing File Attached" : null);
    }
  }, [document, isOpen, form]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Direct uploads are limited to ${MAX_FILE_SIZE_MB}MB. Please use the URL field for larger files.`, variant: "destructive", duration: 7000 });
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("awardProofUrl", null); setSelectedFileName(null); return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("awardProofUrl", reader.result as string);
        form.setValue("awardProofLink", ""); // Clear link field
        setSelectedFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: ProofFormValues) => {
    if (!user || !document) return;
    setIsSubmitting(true);
    const proofValue = values.awardProofUrl || values.awardProofLink || null;
    
    const apiPath = documentType === 'work-order' 
      ? `/api/work-orders/${document.id}` 
      : `/api/purchase-orders/${document.id}`;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ awardProofUrl: proofValue }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to attach proof.');
      }
      toast({ title: "Success", description: "Award proof link saved successfully." });
      onDocumentUpdated();
      onOpenChange(false);
      router.refresh();
    } catch (error: any) {
      console.error("Error attaching award proof:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!document) return null;
  const documentNumber = 'workOrderNumber' in document ? document.workOrderNumber : document.poNumber;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) form.reset(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Attach Award Proof</DialogTitle>
          <DialogDescription>For Document: {documentNumber}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 border-y">
            <Alert variant="default" className="mb-4 bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">File Upload vs. URL</AlertTitle>
                <UIAlertDescription className="text-blue-600 text-xs">
                  You can upload small files (under {MAX_FILE_SIZE_MB}MB) directly, or paste a link from a cloud service for larger files.
                </UIAlertDescription>
            </Alert>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} id={`award-proof-form-${documentType}`} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <FormLabel htmlFor="fileUpload">Upload File (Max {MAX_FILE_SIZE_MB}MB)</FormLabel>
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Input id="fileUpload" type="file" ref={fileInputRef} onChange={handleFileChange} className="flex-1"/>
                      </FormControl>
                      <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /></Button>
                    </div>
                    {selectedFileName && <FormDescription>Selected: {selectedFileName}</FormDescription>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">OR</span>
                    <Separator className="flex-1" />
                  </div>
                  <FormField
                    control={form.control}
                    name="awardProofLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="proofUrlInputWo">Paste Public URL</FormLabel>
                        <FormControl>
                          <Input 
                              id="proofUrlInputWo" 
                              placeholder="https://your-cloud-service.com/proof.pdf" 
                              {...field} 
                              value={field.value ?? ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField control={form.control} name="awardProofUrl" render={() => (<FormMessage />)} />
                </form>
            </Form>
        </div>
        
        {document.awardProofUrl && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Current Proof</h4>
             <a 
                href={document.awardProofUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                download={`AwardProof_${documentNumber}`}
                className={cn(buttonVariants({variant: 'outline'}), "w-full")}
              >
                {document.awardProofUrl.startsWith('data:') ? <DownloadCloud className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                 View/Download Current Proof
              </a>
          </div>
        )}

        <DialogFooter className="pt-4 border-t gap-2 flex-col-reverse sm:flex-row sm:justify-between">
             <DialogClose asChild>
              <Button type="button" variant="secondary"><X className="mr-2 h-4 w-4" /> Close</Button>
            </DialogClose>
            <Button type="submit" form={`award-proof-form-${documentType}`} disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Proof</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
