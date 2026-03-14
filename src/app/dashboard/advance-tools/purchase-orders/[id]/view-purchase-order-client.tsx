
'use client';

import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, ShoppingCart, Edit, Download, Loader2, AlertTriangle, Link as LinkIconOriginal } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { PurchaseOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import ViewPurchaseOrderPageLoadingSkeleton from './loading';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import PurchaseOrderPrintModal from '@/components/purchase-orders/purchase-order-print-modal';
import { useLoading } from '@/contexts/loading-context';

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  pending_approval: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  ordered: "bg-indigo-100 text-indigo-800 border-indigo-300",
  partially_received: "bg-purple-100 text-purple-800 border-purple-300",
  received: "bg-teal-100 text-teal-800 border-teal-300",
  billed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

export default function ViewPurchaseOrderPageContent({ poId }: { poId: string }) {
  const router = useRouter();
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const canView = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewPurchaseOrders;
  const canEdit = isViewingOwnAccount || !!currentTeamMemberPermissions?.canEditPurchaseOrders;
  
  useEffect(() => {
    if (authLoading || !user || !dataOwnerId) {
      if(!authLoading && !user) router.push('/auth/signin');
      return;
    }

    if (!canView) {
      toast({ title: "Permission Denied", description: "You do not have permission to view Purchase Orders.", variant: "destructive" });
      router.push('/dashboard/advance-tools/purchase-orders');
      return;
    }

    if (!poId) {
      toast({ title: "Error", description: "Purchase Order ID is missing.", variant: "destructive" });
      router.push('/dashboard/advance-tools/purchase-orders');
      return;
    }
    
    const fetchPurchaseOrder = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/purchase-orders/${poId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed: ${response.status}`);
        }

        const data: PurchaseOrder = await response.json();
        setPurchaseOrder(data);
      } catch (error:any) {
        console.error("Error fetching purchase order details (via API):", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setPurchaseOrder(null);
        router.push('/dashboard/advance-tools/purchase-orders');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchaseOrder();
  }, [poId, user, dataOwnerId, authLoading, toast, router, canView]);


  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
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
  
  if (!canView && !authLoading && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view this Purchase Order.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/advance-tools/purchase-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Purchase Orders</Link>
        </Button>
      </div>
    );
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/advance-tools/purchase-orders" className="flex items-center">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div> <h1 className="text-2xl font-semibold flex items-center"> <ShoppingCart className="mr-3 h-7 w-7 text-primary" /> Purchase Order Details </h1> <p className="text-muted-foreground">Viewing PO: #{purchaseOrder.poNumber}</p> </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            asChild
            className="flex-grow sm:flex-grow-0"
            disabled={!canEdit}
            onClick={() => setGlobalIsLoading(true)}
          >
            <Link href={`/dashboard/advance-tools/purchase-orders/${purchaseOrder.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button onClick={() => setIsPrintModalOpen(true)} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Download/Print
          </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start"> <CardTitle>PO #{purchaseOrder.poNumber}</CardTitle> <Badge variant="outline" className={`capitalize ${statusColors[purchaseOrder.status] || 'bg-gray-100 text-gray-800'}`}> {purchaseOrder.status.replace(/_/g, " ")} </Badge> </div>
          <CardDescription>Issued by: {purchaseOrder.companyName} | To Supplier: {purchaseOrder.supplierOrganizationName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div> <h3 className="font-semibold mb-1 text-primary">Your Company (Issuer)</h3> <p className="font-medium">{purchaseOrder.companyName}</p> {purchaseOrder.companyAddress && <p className="text-muted-foreground whitespace-pre-line">{purchaseOrder.companyAddress}</p>} </div>
            <div> <h3 className="font-semibold mb-1 text-primary">Supplier Organization</h3> <p className="font-medium">{purchaseOrder.supplierOrganizationName}</p> </div>
          </div>
          <Separator />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div><span className="font-semibold">PO Date:</span> {formatDate(purchaseOrder.date)}</div>
            {purchaseOrder.workOrderNumber && <div><span className="font-semibold">Related Work Order #:</span> {purchaseOrder.workOrderNumber}</div>}
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2 text-primary text-sm">Items</h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader> <TableRow> <TableHead className="w-[60%]">Description</TableHead> <TableHead className="text-right">Qty</TableHead> <TableHead className="text-right">Unit</TableHead> <TableHead className="text-right">Rate</TableHead> <TableHead className="text-right">Amount</TableHead> </TableRow> </TableHeader>
                <TableBody>
                  {purchaseOrder.items.map((item, index) => (
                    <TableRow key={item.id || index} className="page-break-inside-avoid"><TableCell className="font-medium whitespace-pre-wrap">{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.unit}</TableCell><TableCell className="text-right">{formatCurrency(item.rate)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <Separator />
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="text-sm space-y-3">
                {purchaseOrder.shippingAddress && (<div> <h3 className="font-semibold mb-1 text-primary">Shipping Address</h3> <p className="text-muted-foreground whitespace-pre-wrap">{purchaseOrder.shippingAddress}</p> </div>)}
                {purchaseOrder.billingAddress && (<div> <h3 className="font-semibold mb-1 text-primary">Billing Address</h3> <p className="text-muted-foreground whitespace-pre-wrap">{purchaseOrder.billingAddress}</p> </div>)}
                {purchaseOrder.paymentTerms && (<div> <h3 className="font-semibold mb-1 text-primary">Payment Terms</h3> <p className="text-muted-foreground whitespace-pre-wrap">{purchaseOrder.paymentTerms}</p> </div>)}
                {purchaseOrder.notes && (<div> <h3 className="font-semibold mb-1 text-primary">Notes</h3> <p className="text-muted-foreground whitespace-pre-wrap">{purchaseOrder.notes}</p> </div>)}
            </div>
            <div className="space-y-2">
              <Card className="bg-secondary/50 p-4 text-sm">
                <CardContent className="space-y-1 p-0">
                  <div className="flex justify-between"><span>Subtotal:</span> <span className="font-medium">{formatCurrency(purchaseOrder.subTotal)}</span></div>
                  {(purchaseOrder.taxAmount != null) && (<div className="flex justify-between"><span>Tax ({purchaseOrder.taxRate || 0}%):</span> <span className="font-medium">{formatCurrency(purchaseOrder.taxAmount)}</span></div>)}
                  <Separator className="my-1"/>
                  <div className="flex justify-between text-md font-bold text-primary"><span>Grand Total:</span> <span>{formatCurrency(purchaseOrder.grandTotal)}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4"> <p className="text-xs text-muted-foreground"> Last updated: {purchaseOrder.updatedAt ? new Date(purchaseOrder.updatedAt).toLocaleString() : 'N/A'} by {purchaseOrder.updatedByName || 'N/A'} </p> </CardFooter>
      </Card>
       {purchaseOrder && (
        <PurchaseOrderPrintModal
          isOpen={isPrintModalOpen}
          onOpenChange={setIsPrintModalOpen}
          purchaseOrder={purchaseOrder}
        />
      )}
    </div>
  );
}
