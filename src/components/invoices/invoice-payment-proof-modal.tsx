
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import type { Invoice, OtherDeduction } from '@/types';
import { Save, Loader2, X, Info, ExternalLink, UploadCloud, DownloadCloud, PlusCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from '../ui/alert';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

const MAX_FILE_SIZE_MB = 0.75; // 750KB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const otherDeductionSchema = z.object({
    description: z.string().min(1, "Deduction description is required."),
    amount: z.coerce.number().positive("Deduction amount must be positive."),
});

const proofFormSchema = z.object({
  paymentProofUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, { message: "File data is too large." }).optional().nullable(),
  paymentProofLink: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  amountPaid: z.coerce.number().min(0, "Amount must be non-negative."),
  sdDeducted: z.coerce.number().min(0, "SD must be non-negative.").optional().nullable(),
  tdsDeducted: z.coerce.number().min(0, "TDS must be non-negative.").optional().nullable(),
  ldDeducted: z.coerce.number().min(0, "LD must be non-negative.").optional().nullable(),
  otherDeductions: z.array(otherDeductionSchema).optional(),
}).refine(data => {
    if (data.paymentProofUrl && data.paymentProofLink) {
        return false;
    }
    if (data.paymentProofLink) {
        return z.string().url().safeParse(data.paymentProofLink).success;
    }
    return true;
}, {
    message: "Please provide either a file upload or a URL, not both.",
    path: ['paymentProofUrl']
});


type ProofFormValues = z.infer<typeof proofFormSchema>;

interface InvoicePaymentProofModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onInvoiceUpdated: () => void;
}

export default function InvoicePaymentProofModal({
  isOpen,
  onOpenChange,
  invoice,
  onInvoiceUpdated,
}: InvoicePaymentProofModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(invoice?.paymentProofUrl || null);

  const form = useForm<ProofFormValues>({
    resolver: zodResolver(proofFormSchema),
    defaultValues: {
      paymentProofUrl: null,
      paymentProofLink: '',
      amountPaid: invoice?.amountPaid || 0,
      sdDeducted: invoice?.sdDeducted || 0,
      tdsDeducted: invoice?.tdsDeducted || 0,
      ldDeducted: invoice?.ldDeducted || 0,
      otherDeductions: invoice?.otherDeductions || [],
    },
    mode: "onChange",
  });

    const { control, handleSubmit, reset, watch } = form;
    const { fields, append, remove } = useFieldArray({
        control,
        name: "otherDeductions"
    });

    const watchedPaymentProofLink = watch('paymentProofLink');
    const watchedPaymentProofUrl = watch('paymentProofUrl');
    const watchedAmountPaid = watch('amountPaid');
    const watchedSdDeducted = watch('sdDeducted');
    const watchedTdsDeducted = watch('tdsDeducted');
    const watchedLdDeducted = watch('ldDeducted');

  useEffect(() => {
    if (invoice) {
      const isUrl = invoice.paymentProofUrl?.startsWith('http');
      reset({
        paymentProofUrl: null, // Always clear file on open
        paymentProofLink: isUrl ? invoice.paymentProofUrl || "" : "",
        amountPaid: invoice.amountPaid || 0,
        sdDeducted: invoice.sdDeducted || 0,
        tdsDeducted: invoice.tdsDeducted || 0,
        ldDeducted: invoice.ldDeducted || 0,
        otherDeductions: invoice.otherDeductions || [],
      });
      setProofUrl(invoice.paymentProofUrl || null);
    }
  }, [invoice, reset, isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "File too large", description: `File size must be less than ${MAX_FILE_SIZE_MB} MB.` });
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        form.setValue("paymentProofUrl", base64String);
        form.setValue("paymentProofLink", ""); // Clear link field
    };
    reader.onerror = (error) => {
        toast({ variant: "destructive", title: "File Error", description: `Error reading file: ${error}` });
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: ProofFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        paymentProofUrl: data.paymentProofLink || data.paymentProofUrl || proofUrl, // Preserve existing URL if no new one is provided
        amountPaid: data.amountPaid,
        sdDeducted: data.sdDeducted,
        tdsDeducted: data.tdsDeducted,
        ldDeducted: data.ldDeducted,
        otherDeductions: data.otherDeductions,
      };

      const response = await fetch(`/api/invoices/${invoice?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Invoice updated successfully!" });
        onInvoiceUpdated();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        toast({ variant: "destructive", title: "Error", description: errorData.error || "Failed to update invoice." });
      }
    } catch (error: any) {
      console.error("Invoice update failed:", error);
      toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to update invoice." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDownload = () => {
    if (!proofUrl) {
      toast({ variant: "destructive", title: "Error", description: "No proof available to download." });
      return;
    }
    const link = document.createElement('a');
    link.href = proofUrl;
    link.download = `invoice_${invoice?.invoiceNumber}_payment_proof`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle>Update Payment Status & Deductions</DialogTitle>
          <DialogDescription>
            Attach payment proof and record deductions for invoice #{invoice?.invoiceNumber}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} id="payment-proof-form">
            <ScrollArea className="h-[60vh] -mt-4">
              <div className="px-6 py-4 space-y-4">
                  {/* File Upload */}
                  <div>
                    <FormLabel>Payment Proof <Info className="h-3 w-3 inline-block align-middle ml-1" /></FormLabel>
                    <FormDescription>
                        Upload proof of payment (max {MAX_FILE_SIZE_MB}MB).
                    </FormDescription>
                    <FormControl>
                      <div className="flex items-center space-x-4 mt-2">
                        <Input
                          type="file"
                          accept="image/*, application/pdf"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSubmitting}
                        >
                          <UploadCloud className="h-4 w-4 mr-2" />
                          {form.watch('paymentProofUrl') ? 'Change File' : 'Upload File'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={isSubmitting || !proofUrl}
                          onClick={onDownload}
                        >
                          <DownloadCloud className="h-4 w-4 mr-2" />
                          Download Proof
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </div>

                  <div className="flex items-center gap-2">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">OR</span>
                    <Separator className="flex-1" />
                  </div>

                  {/* Payment Proof Link */}
                  <FormField
                      control={control}
                      name="paymentProofLink"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Provide Payment Proof Link</FormLabel>
                              <FormControl>
                                  <Input placeholder="https://example.com/payment-proof.pdf" {...field} disabled={isSubmitting} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />

                  <Separator />

                  {/* Amount Paid */}
                  <FormField
                    control={control}
                    name="amountPaid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Paid</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0.00" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Deductions */}
                  <div>
                      <FormLabel>Deductions</FormLabel>
                      <FormDescription>
                          Record any deductions from the invoice total.
                      </FormDescription>
                      <div className="grid grid-cols-3 gap-4 mt-2">
                          <FormField control={control} name="sdDeducted" render={({ field }) => ( <FormItem><FormLabel className="text-xs">SD</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} disabled={isSubmitting} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem> )}/>
                          <FormField control={control} name="tdsDeducted" render={({ field }) => ( <FormItem><FormLabel className="text-xs">TDS</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} disabled={isSubmitting} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem> )}/>
                          <FormField control={control} name="ldDeducted" render={({ field }) => ( <FormItem><FormLabel className="text-xs">LD</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} disabled={isSubmitting} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem> )}/>
                      </div>
                  </div>

                  <Separator />

                  {/* Other Deductions */}
                  <div>
                      <FormLabel>Other Deductions</FormLabel>
                      <FormDescription>Add any other custom deductions.</FormDescription>
                      {fields.map((field, index) => (
                          <div key={field.id} className="flex items-end space-x-2 mt-2">
                              <FormField control={control} name={`otherDeductions.${index}.description`} render={({ field }) => (<FormItem className="flex-1"><FormLabel className="text-xs">Description</FormLabel><FormControl><Input placeholder="Description" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                              <FormField control={control} name={`otherDeductions.${index}.amount`} render={({ field }) => (<FormItem className="w-1/3"><FormLabel className="text-xs">Amount</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={isSubmitting} className="h-9 w-9"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                      ))}
                      <Button type="button" variant="link" onClick={() => append({ description: '', amount: 0 })} disabled={isSubmitting} className="p-0 h-auto mt-2 text-xs"><PlusCircle className="w-4 h-4 mr-2" />Add Deduction</Button>
                  </div>

                </div>
            </ScrollArea>
          </form>
        </Form>
        <DialogFooter className="p-6 pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button></DialogClose>
          <Button type="submit" form="payment-proof-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
