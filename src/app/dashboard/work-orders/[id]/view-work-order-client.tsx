
'use client';

import { useEffect, useState, Suspense } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Receipt, Edit, Download, Loader2, AlertTriangle, Link as LinkIconOriginal, FileText, DownloadCloud, UploadCloud, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { WorkOrder, Invoice as AppInvoice, LabourRegister, Document as AppDocument, DailyProgressReport, ServiceVisitReport, PurchaseOrder, Expense } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import ViewWorkOrderPageLoadingSkeleton from './loading';
import { formatCurrency } from '@/lib/utils';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import ViewWorkOrderDocumentsModal from '@/components/work-orders/view-work-order-documents-modal';
import AwardProofModal from '@/components/purchase-orders/award-proof-modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  "in-progress": "bg-indigo-100 text-indigo-800 border-indigo-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  "on-hold": "bg-orange-100 text-orange-800 border-orange-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

export default function ViewWorkOrderPageContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [linkedData, setLinkedData] = useState<{
    invoices: AppInvoice[],
    labour: LabourRegister[],
    documents: AppDocument[],
    dprs: DailyProgressReport[],
    svrs: ServiceVisitReport[],
    purchaseOrders: PurchaseOrder[],
    expenses: Expense[],
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);


  const fetchWorkOrderDetails = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/work-orders/${id}/details`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch work order details.');
        }

        const data = await response.json();
        setWorkOrder(data.workOrder);
        setLinkedData({
            invoices: data.linkedInvoices || [],
            labour: data.linkedLabour || [],
            documents: data.linkedDocuments || [],
            dprs: data.linkedDprs || [],
            svrs: data.linkedSvrs || [],
            purchaseOrders: data.linkedPurchaseOrders || [],
            expenses: data.linkedExpenses || [],
        });

      } catch (error:any) {
        toast({ title: "Error", description: `Failed to load work order details: ${error.message}`, variant: "destructive" });
        setWorkOrder(null);
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
    if (!id) {
      toast({ title: "Error", description: "Work Order ID is missing.", variant: "destructive" });
      router.push('/dashboard/work-orders');
      return;
    }

    fetchWorkOrderDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, authLoading, toast, router]);

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) {
      try { return format(new Date(dateString), 'dd MMM yyyy'); }
      catch (parseErr) { return dateString; }
    }
  };

  if (isLoading || authLoading) {
    return <ViewWorkOrderPageLoadingSkeleton />;
  }

  if (!workOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Work Order Not Available</h2>
        <p className="text-muted-foreground mb-4">The requested work order could not be found or you do not have permission to view it.</p>
        <Button asChild variant="outline"> <Link href="/dashboard/work-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Work Orders</Link> </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Main Work Order Details Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/work-orders" className="flex items-center">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <ClipboardList className="mr-3 h-7 w-7 text-primary" /> Work Order Details
            </h1>
            <p className="text-muted-foreground">Viewing Work Order: #{workOrder.workOrderNumber}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            asChild
            className="flex-grow sm:flex-grow-0"
            onClick={() => setGlobalIsLoading(true)}
          >
            <Link href={`/dashboard/work-orders/${workOrder.id}?edit=true`} className="flex items-center">
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button onClick={() => setIsProofModalOpen(true)} variant="outline" className="flex-grow sm:flex-grow-0">
             <UploadCloud className="mr-2 h-4 w-4" />{workOrder.awardProofUrl ? 'Change Proof' : 'Attach Proof'}
          </Button>
          <Button asChild className="flex-grow sm:flex-grow-0" disabled={workOrder.status === 'cancelled' || workOrder.status === 'draft'} onClick={() => setGlobalIsLoading(true)}>
            <Link href={`/dashboard/invoices/new?workOrderId=${workOrder.id}`}>
              <Receipt className="mr-2 h-4 w-4" /> Create Invoice
            </Link>
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start"> <CardTitle>WO #{workOrder.workOrderNumber}</CardTitle> <Badge variant="outline" className={`capitalize ${statusColors[workOrder.status] || ''}`}> {workOrder.status.replace("-", " ")} </Badge> </div>
          <CardDescription>Issued by: {workOrder.companyName} | For: {workOrder.organizationName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div> <h3 className="font-semibold mb-1 text-primary">From:</h3> <p className="font-medium">{workOrder.companyName}</p> {workOrder.companyAddress && <p className="text-muted-foreground whitespace-pre-line">{workOrder.companyAddress}</p>} </div>
            <div> <h3 className="font-semibold mb-1 text-primary">To:</h3> <p className="font-medium">{workOrder.organizationName}</p> </div>
          </div>
          <Separator/>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div><span className="font-semibold">Start Date:</span> {formatDate(workOrder.startDate)}</div>
            <div><span className="font-semibold">End Date:</span> {formatDate(workOrder.endDate)}</div>
            {workOrder.estimateId && <div><span className="font-semibold">Related Estimate #:</span> {workOrder.estimateId}</div>} {(workOrder.securityDeposit !== undefined && workOrder.securityDeposit !== null && workOrder.securityDeposit > 0) && (<div><span className="font-semibold">Security Deposit:</span> {formatCurrency(workOrder.securityDeposit)}</div>)} {(workOrder.depositPeriod !== undefined && workOrder.depositPeriod !== null && workOrder.depositPeriod > 0) &&(<div><span className="font-semibold">Deposit Period:</span> {workOrder.depositPeriod} months</div>)} </div>
          {workOrder.scopeOfWork && (<> <Separator /> <div> <h3 className="font-semibold mb-1 text-primary text-sm">Scope of Work / Description</h3> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workOrder.scopeOfWork}</p> </div> </>)}
          <Separator />
          <div> <h3 className="font-semibold mb-2 text-primary text-sm">Work Order Items</h3> <div className="overflow-x-auto rounded-md border"> <Table><TableHeader><TableRow><TableHead className="w-[50%]">Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{workOrder.items.map((item, index) => ( <TableRow key={index} className="page-break-inside-avoid"><TableCell className="font-medium whitespace-pre-wrap">{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.unit}</TableCell><TableCell className="text-right">{formatCurrency(item.rate)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell></TableRow> ))}</TableBody></Table> </div> </div>
          <Separator />
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {workOrder.termsAndConditions && (<div className="text-sm"> <h3 className="font-semibold mb-1 text-primary">Terms & Conditions</h3> <p className="text-muted-foreground whitespace-pre-wrap">{workOrder.termsAndConditions}</p> </div>)} <div className={!workOrder.termsAndConditions ? "md:col-start-2" : ""}> <Card className="bg-secondary/50 p-4 text-sm"> <CardContent className="space-y-1 p-0"> <div className="flex justify-between"><span>Subtotal:</span> <span className="font-medium">{formatCurrency(workOrder.subTotal)}</span></div> {(workOrder.taxRate !== undefined && workOrder.taxRate !== null && workOrder.taxRate > 0) && (<div className="flex justify-between"><span>Tax ({workOrder.taxRate}%):</span> <span className="font-medium">{formatCurrency(workOrder.taxAmount)}</span></div>)} <Separator className="my-1 bg-border"/> <div className="flex justify-between text-md font-bold text-primary"><span>Grand Total:</span> <span>{formatCurrency(workOrder.grandTotal)}</span></div> </CardContent> </Card> </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4"> <p className="text-xs text-muted-foreground"> Last updated: {workOrder.updatedAt ? new Date(workOrder.updatedAt).toLocaleString() : 'N/A'} by {workOrder.updatedByName || 'N/A'} </p> </CardFooter>
      </Card>
      
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Linked Invoices</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-10"/> : linkedData?.invoices?.length ? <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{linkedData.invoices.map(inv => (<TableRow key={inv.id}><TableCell><Link href={`/dashboard/invoices/${inv.id}`} className="text-primary hover:underline">{inv.invoiceNumber}</Link></TableCell><TableCell>{formatDate(inv.date)}</TableCell><TableCell><Badge variant="outline" className={`capitalize ${statusColors[inv.status] || ''}`}>{inv.status.replace("-"," ")}</Badge></TableCell><TableCell className="text-right">{formatCurrency(inv.grandTotal)}</TableCell></TableRow>))}</TableBody></Table> : <p>No invoices.</p>}</CardContent>
        </Card>
         <Card>
          <CardHeader><CardTitle>Linked Purchase Orders</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-10"/> : linkedData?.purchaseOrders?.length ? <Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{linkedData.purchaseOrders.map(po => (<TableRow key={po.id}><TableCell><Link href={`/dashboard/advance-tools/purchase-orders/${po.id}`} className="text-primary hover:underline">{po.poNumber}</Link></TableCell><TableCell>{formatDate(po.date)}</TableCell><TableCell>{po.supplierOrganizationName}</TableCell><TableCell><Badge variant="outline" className={`capitalize ${statusColors[po.status] || ''}`}>{po.status.replace(/_/g," ")}</Badge></TableCell><TableCell className="text-right">{formatCurrency(po.grandTotal)}</TableCell></TableRow>))}</TableBody></Table> : <p>No purchase orders.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Linked Expenses</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-10"/> : linkedData?.expenses?.length ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{linkedData.expenses.map(exp => (<TableRow key={exp.id}><TableCell>{formatDate(exp.date)}</TableCell><TableCell>{exp.category}</TableCell><TableCell>{exp.description}</TableCell><TableCell className="text-right">{formatCurrency(exp.amount)}</TableCell></TableRow>))}</TableBody></Table> : <p>No expenses.</p>}</CardContent>
        </Card>
         <Card>
          <CardHeader><CardTitle>Linked Documents</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-10"/> : linkedData?.documents?.length ? <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{linkedData.documents.map(doc => (<TableRow key={doc.id}><TableCell>{doc.documentName}</TableCell><TableCell>{doc.documentType}</TableCell><TableCell>{formatDate(doc.dateUploaded)}</TableCell><TableCell className="text-right"><a href={doc.documentUrl ?? undefined} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'ghost', size: 'sm'})}>View</a></TableCell></TableRow>))}</TableBody></Table> : <p>No documents.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Registered Labour</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-10"/> : linkedData?.labour?.length ? <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Daily Wage</TableHead></TableRow></TableHeader><TableBody>{linkedData.labour.map(lab => (<TableRow key={lab.id}><TableCell>{lab.workerName}</TableCell><TableCell>{lab.role}</TableCell><TableCell className="text-right">{formatCurrency(lab.dailyWage)}</TableCell></TableRow>))}</TableBody></Table> : <p>No labour registered.</p>}</CardContent>
        </Card>
         <Card>
          <CardHeader><CardTitle>Daily Progress Reports</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-10"/> : linkedData?.dprs?.length ? <Table><TableHeader><TableRow><TableHead>Report Date</TableHead><TableHead>Rating</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{linkedData.dprs.map(dpr => (<TableRow key={dpr.id}><TableCell>{formatDate(dpr.reportDate)}</TableCell><TableCell>{dpr.workRating}/10</TableCell><TableCell className="text-right"><Link href={`/dashboard/dpr/${dpr.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm'})}>View</Link></TableCell></TableRow>))}</TableBody></Table> : <p>No DPRs logged.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Service Visit Reports</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-10"/> : linkedData?.svrs?.length ? <Table><TableHeader><TableRow><TableHead>Visit Date</TableHead><TableHead>Purpose</TableHead><TableHead className="text-right">Rating</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{linkedData.svrs.map(svr => (<TableRow key={svr.id}><TableCell>{formatDate(svr.visitDate)}</TableCell><TableCell className="truncate max-w-xs">{svr.purposeOfVisit}</TableCell><TableCell className="text-right">{svr.visitRating}/10</TableCell><TableCell className="text-right"><Link href={`/dashboard/svr/${svr.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm'})}>View</Link></TableCell></TableRow>))}</TableBody></Table> : <p>No SVRs logged.</p>}</CardContent>
        </Card>
      </div>
      
       {workOrder && (
        <AwardProofModal
          isOpen={isProofModalOpen}
          onOpenChange={setIsProofModalOpen}
          document={workOrder}
          onDocumentUpdated={fetchWorkOrderDetails}
          documentType='work-order'
        />
      )}
    </div>
  );
}
