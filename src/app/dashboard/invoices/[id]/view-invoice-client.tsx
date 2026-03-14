
'use client';

import { useEffect, useState, Suspense } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Receipt, Edit, Download, Loader2, AlertTriangle, Link as LinkIconOriginal, FileText, DownloadCloud, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { Invoice } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import InvoicePrintModal from '@/components/invoices/invoice-print-modal';
import InvoicePaymentProofModal from '@/components/invoices/invoice-payment-proof-modal';
import ViewInvoicePageLoadingSkeleton from './loading';
import { formatCurrency } from '@/lib/utils';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  sent: "bg-blue-100 text-blue-800 border-blue-300",
  paid: "bg-green-100 text-green-800 border-green-300",
  unpaid: "bg-yellow-100 text-yellow-800 border-yellow-300",
  overdue: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-orange-100 text-orange-800 border-orange-300",
  'partially-paid': "bg-purple-100 text-purple-800 border-purple-300",
};

export default function ViewInvoicePageContent({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  
  const fetchInvoice = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/invoices/${invoiceId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed: ${response.status}`);
        }
        const data: Invoice = await response.json();
        setInvoice(data);
      } catch (error:any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setInvoice(null);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    if (!invoiceId) {
      toast({ title: "Error", description: "Invoice ID is missing.", variant: "destructive" });
      router.push('/dashboard/invoices');
      return;
    }

    fetchInvoice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, user, authLoading, toast, router]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) {
      try { return format(new Date(dateString), 'dd MMM yyyy'); }
      catch (parseErr) { return dateString; }
    }
  };

  if (isLoading || authLoading) {
    return <ViewInvoicePageLoadingSkeleton />;
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested invoice could not be found or you do not have permission to view it.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/invoices" className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/invoices" className="flex items-center">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <Receipt className="mr-3 h-7 w-7 text-primary" /> Invoice Details
            </h1>
            <p className="text-muted-foreground">Viewing Invoice: #{invoice.invoiceNumber}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <Button
            variant="outline"
            asChild
            className="flex-grow sm:flex-grow-0"
            onClick={() => setGlobalIsLoading(true)}
          >
            <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="flex items-center">
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
           <Button onClick={() => setIsProofModalOpen(true)} variant="outline" className="flex-grow sm:flex-grow-0">
             <UploadCloud className="mr-2 h-4 w-4" />{invoice.paymentProofUrl ? 'Change Proof' : 'Attach Proof'}
          </Button>
          {invoice.paymentProofUrl && (
            <a
              href={invoice.paymentProofUrl}
              download={`PaymentProof_Inv_${invoice.invoiceNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', className: 'w-full sm:w-auto flex-grow sm:flex-grow-0' }))}
            >
              <DownloadCloud className="mr-2 h-4 w-4" /> Download Proof
            </a>
          )}
          <Button onClick={() => setIsPrintModalOpen(true)} className="w-full sm:w-auto flex-grow sm:flex-grow-0">
            <Download className="mr-2 h-4 w-4" /> Download/Print
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start"> <CardTitle>Invoice #{invoice.invoiceNumber}</CardTitle> <Badge variant="outline" className={`capitalize ${statusColors[invoice.status] || ''}`}> {invoice.status.replace("-", " ")} </Badge> </div>
          <CardDescription>
            From: {invoice.companyName} | To: {invoice.organizationName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-semibold mb-1 text-primary">From:</h3>
              <p className="font-medium">{invoice.companyName}</p>
              {invoice.companyAddress && <p className="text-muted-foreground whitespace-pre-line">{invoice.companyAddress}</p>}
              {invoice.companyGstin && <p className="text-muted-foreground">GSTIN: {invoice.companyGstin}</p>}
            </div>
            <div className="md:text-right">
              <h3 className="font-semibold mb-1 text-primary">To:</h3>
              <p className="font-medium">{invoice.organizationName}</p>
              {invoice.organizationAddress && <p className="text-muted-foreground whitespace-pre-line">{invoice.organizationAddress}</p>}
              {invoice.organizationGstin && <p className="text-muted-foreground">GSTIN: {invoice.organizationGstin}</p>}
            </div>
          </div>
          <Separator/>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div><span className="font-semibold">Invoice Date:</span> {formatDate(invoice.date)}</div>
            <div><span className="font-semibold">Due Date:</span> {formatDate(invoice.dueDate)}</div>
            {invoice.workOrderNumber && <div className="font-semibold">Work Order #: {invoice.workOrderNumber}</div>}
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2 text-primary text-sm">Invoice Items</h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item, index) => (
                    <TableRow key={index} className="page-break-inside-avoid"><TableCell className={cn("font-medium whitespace-pre-wrap")}>{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.unit}</TableCell><TableCell className="text-right">{formatCurrency(item.rate)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <Separator/>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="text-sm space-y-3">
              {invoice.paymentInstructions && (
                <div>
                  <h3 className="font-semibold mb-1 text-primary">Payment Instructions</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{invoice.paymentInstructions}</p>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <h3 className="font-semibold mb-1 text-primary">Notes</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Card className="bg-secondary/50 p-4 text-sm">
                <CardContent className="space-y-1 p-0">
                  <div className="flex justify-between"><span>Subtotal:</span> <span className="font-medium">{formatCurrency(invoice.subTotal)}</span></div>
                  {(invoice.taxRate != null && invoice.taxRate > 0) && (<div className="flex justify-between"><span>Tax ({invoice.taxRate}%):</span> <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span></div>)}
                  <Separator className="my-1 bg-border"/>
                  <div className="flex justify-between text-md font-bold text-primary"><span>Grand Total:</span> <span>{formatCurrency(invoice.grandTotal)}</span></div>
                  {(invoice.amountPaid != null && invoice.amountPaid > 0) && (<div className="flex justify-between pt-1 border-t mt-1"><span>Amount Paid:</span> <span className="font-medium text-green-600">-{formatCurrency(invoice.amountPaid)}</span></div>)}
                  <Separator className="my-1"/>
                  <div className="flex justify-between text-md font-bold text-destructive"><span>Balance Due:</span> <span>{formatCurrency(invoice.balanceDue)}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4"> <p className="text-xs text-muted-foreground"> Last updated: {invoice.updatedAt ? new Date(invoice.updatedAt).toLocaleString() : 'N/A'} by {invoice.updatedByName || 'N/A'} </p> </CardFooter>
      </Card>
      
      {invoice && (
        <InvoicePrintModal
          isOpen={isPrintModalOpen}
          onOpenChange={setIsPrintModalOpen}
          invoice={invoice}
        />
      )}
      {invoice && (
        <InvoicePaymentProofModal
          isOpen={isProofModalOpen}
          onOpenChange={setIsProofModalOpen}
          invoice={invoice}
          onInvoiceUpdated={fetchInvoice}
        />
      )}
    </div>
  );
}
