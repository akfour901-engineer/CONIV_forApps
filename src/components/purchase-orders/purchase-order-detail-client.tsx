'use client';

import { useEffect, useState, Suspense } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Edit, Download, Loader2, AlertTriangle, FileText, UploadCloud, CheckCircle, IndianRupee } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { PurchaseOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import ViewPurchaseOrderPageLoadingSkeleton from '@/app/dashboard/advance-tools/purchase-orders/[id]/loading';
import { formatCurrency } from '@/lib/utils';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import AwardProofModal from '@/components/purchase-orders/award-proof-modal';
import PurchaseOrderPrintModal from './purchase-order-print-modal';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { PO_COMMIT_TO_EXPENSE_COST } from '@/lib/constants';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  pending_approval: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  ordered: "bg-indigo-100 text-indigo-800 border-indigo-300",
  partially_received: "bg-purple-100 text-purple-800 border-purple-300",
  received: "bg-cyan-100 text-cyan-800 border-cyan-300",
  billed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

export default function ViewPurchaseOrderPageContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, loading: authLoading, dataOwnerId, userProfile, appConfig } = useAuth();
  const { toast } = useToast();
  
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const fetchPurchaseOrderDetails = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/purchase-orders/${id}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch purchase order details.');
        }
        const data = await response.json();
        setPurchaseOrder(data);
      } catch (error:any) {
        toast({ title: "Error", description: `Failed to load PO details: ${error.message}`, variant: "destructive" });
        setPurchaseOrder(null);
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
      toast({ title: "Error", description: "PO ID is missing.", variant: "destructive" });
      router.push('/dashboard/advance-tools/purchase-orders');
      return;
    }

    fetchPurchaseOrderDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, authLoading, toast, router]);
  
   const handleCommitToExpenses = async () => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) return;
    const cost = appConfig?.actionCosts?.find(c => c.key === 'PO_COMMIT_TO_EXPENSE_COST')?.cost ?? PO_COMMIT_TO_EXPENSE_COST;
    if ((userProfile.resourcePoints ?? 0) < cost) {
      setPointsInfo({ required: cost, current: userProfile.resourcePoints ?? 0 });
      setIsPointsDialogOpen(true);
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/purchase-orders/${id}/commit-expense`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to commit expense.');

      // if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
      //   updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
      // }
      toast({ title: "Success", description: "PO value has been recorded as an expense." });
      fetchPurchaseOrderDetails();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) {
      try { return format(new Date(dateString), 'dd MMM yyyy'); }
      catch (parseErr) { return dateString; }
    }
  };

  if (isLoading || authLoading) {
    return <ViewPurchaseOrderPageLoadingSkeleton />;
  }

  if (!purchaseOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Purchase Order Not Available</h2>
        <p className="text-muted-foreground mb-4">The requested PO could not be found or you do not have permission to view it.</p>
        <Button asChild variant="outline"> <Link href="/dashboard/advance-tools/purchase-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back to POs</Link> </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Main Purchase Order Details Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/advance-tools/purchase-orders" className="flex items-center">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <FileText className="mr-3 h-7 w-7 text-primary" /> Purchase Order Details
            </h1>
            <p className="text-muted-foreground">Viewing PO: #{purchaseOrder.poNumber}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="secondary" onClick={() => setIsPrintModalOpen(true)} className="flex-grow sm:flex-grow-0">
            <Download className="mr-2 h-4 w-4"/>Download/Print
          </Button>
          <Button onClick={() => setIsProofModalOpen(true)} variant="outline" className="flex-grow sm:flex-grow-0">
             <UploadCloud className="mr-2 h-4 w-4" />{purchaseOrder.awardProofUrl ? 'Change Proof' : 'Attach Proof'}
          </Button>
          <Button asChild className="flex-grow sm:flex-grow-0">
            <Link href={`/dashboard/advance-tools/purchase-orders/${purchaseOrder.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start"> <CardTitle>PO #{purchaseOrder.poNumber}</CardTitle> <Badge variant="outline" className={`capitalize ${statusColors[purchaseOrder.status] || ''}`}> {purchaseOrder.status.replace(/_/g, " ")} </Badge> </div>
          <CardDescription>Issued by: {purchaseOrder.companyName} | To: {purchaseOrder.supplierOrganizationName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div><span className="font-semibold">Date:</span> {formatDate(purchaseOrder.date)}</div>
            <div><span className="font-semibold">Linked Work Order:</span> {purchaseOrder.workOrderNumber || 'N/A'}</div>
          </div>
          <Separator/>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div> <h3 className="font-semibold mb-1 text-primary">Billing Address:</h3> <p className="text-sm text-gray-700 whitespace-pre-wrap">{purchaseOrder.billingAddress || 'Not Specified'}</p> </div>
            <div> <h3 className="font-semibold mb-1 text-primary">Shipping Address:</h3> <p className="text-sm text-gray-700 whitespace-pre-wrap">{purchaseOrder.shippingAddress || 'Not Specified'}</p> </div>
          </div>
          <Separator />
          <div> <h3 className="font-semibold mb-2 text-primary text-sm">PO Items</h3> <div className="overflow-x-auto rounded-md border"> <Table><TableHeader><TableRow><TableHead className="w-[50%]">Item / Service Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{purchaseOrder.items.map((item, index) => ( <TableRow key={item.id || index}><TableCell className="font-medium whitespace-pre-wrap">{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.unit}</TableCell><TableCell className="text-right">{formatCurrency(item.rate)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell></TableRow> ))}</TableBody></Table> </div> </div>
          <Separator />
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {purchaseOrder.paymentTerms && (<div className="text-sm"> <h3 className="font-semibold mb-1 text-primary">Payment Terms</h3> <p className="text-muted-foreground whitespace-pre-wrap">{purchaseOrder.paymentTerms}</p> </div>)}
            <div className={!purchaseOrder.paymentTerms ? "md:col-start-2" : ""}> <Card className="bg-secondary/50 p-4 text-sm"> <CardContent className="space-y-1 p-0"> <div className="flex justify-between"><span>Subtotal:</span> <span className="font-medium">{formatCurrency(purchaseOrder.subTotal)}</span></div> {(purchaseOrder.taxRate != null && purchaseOrder.taxRate > 0) && (<div className="flex justify-between"><span>Tax ({purchaseOrder.taxRate}%):</span> <span className="font-medium">{formatCurrency(purchaseOrder.taxAmount)}</span></div>)} <Separator className="my-1 bg-border"/> <div className="flex justify-between text-md font-bold text-primary"><span>Grand Total:</span> <span>{formatCurrency(purchaseOrder.grandTotal)}</span></div> </CardContent> </Card> </div>
          </div>
        </CardContent>
         <CardFooter className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">Last updated: {purchaseOrder.updatedAt ? new Date(purchaseOrder.updatedAt).toLocaleString() : 'N/A'}</p>
            {!purchaseOrder.linkedExpenseId && <Button onClick={handleCommitToExpenses} disabled={isLoading} variant="secondary"> <CheckCircle className="mr-2 h-4 w-4"/> Commit as Expense </Button>}
            {purchaseOrder.linkedExpenseId && <p className="text-xs font-semibold text-green-600 flex items-center"><CheckCircle className="mr-1.5 h-4 w-4"/>Already recorded as an expense.</p>}
        </CardFooter>
      </Card>
      
       <PurchaseOrderPrintModal 
         isOpen={isPrintModalOpen} 
         onOpenChange={setIsPrintModalOpen} 
         purchaseOrder={purchaseOrder} 
       />
      
       <AwardProofModal
          isOpen={isProofModalOpen}
          onOpenChange={setIsProofModalOpen}
          document={purchaseOrder}
          onDocumentUpdated={fetchPurchaseOrderDetails}
          documentType='purchase-order'
        />

        <InsufficientPointsDialog
            isOpen={isPointsDialogOpen}
            onOpenChange={setIsPointsDialogOpen}
            requiredPoints={pointsInfo.required}
            currentPoints={pointsInfo.current}
        />
    </div>
  );
}