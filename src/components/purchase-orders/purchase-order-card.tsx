
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import { Eye, Edit, Trash2, Settings2, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { PurchaseOrder } from '@/types';

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

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy'); }
  catch (e) { try { return format(new Date(dateString), 'dd MMM yyyy'); } catch (parseErr) { return dateString; } }
};

interface PurchaseOrderCardProps {
  po: PurchaseOrder;
  onDelete: (poId: string, poNumber: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canDelete: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

export const PurchaseOrderCard = React.memo(({ po, onDelete, isDeleting, currentDeletingId, canDelete, setGlobalIsLoading }: PurchaseOrderCardProps) => {
  const isDeleteActionAllowed = ['draft', 'pending_approval', 'cancelled'].includes(po.status);
  
  return (
    <Card key={po.id} className="shadow-sm flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-md">{po.poNumber}</CardTitle>
          <Badge variant="outline" className={`capitalize ${statusColors[po.status] || ''}`}>{po.status.replace(/_/g, " ")}</Badge>
        </div>
        <CardDescription className="text-xs truncate" title={po.supplierOrganizationName}>To: {po.supplierOrganizationName}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1 flex-grow">
        <p><span className="font-medium">Date:</span> {formatDate(po.date)}</p>
        <p><span className="font-medium">Amount:</span> {formatCurrency(po.grandTotal)}</p>
        <p><span className="font-medium">Company:</span> {po.companyName ?? 'N/A'}</p>
        {po.workOrderNumber && <p><span className="font-medium">WO#:</span> {po.workOrderNumber}</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                    Actions <Settings2 className="ml-2 h-4 w-4"/>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild onClick={() => setGlobalIsLoading(true)}>
                    <Link href={`/dashboard/advance-tools/purchase-orders/${po.id}`}>
                        <Eye className="mr-2 h-4 w-4"/>View Details
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild onClick={() => setGlobalIsLoading(true)}>
                     <Link href={`/dashboard/advance-tools/purchase-orders/${po.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4"/>Edit PO
                     </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canDelete || !isDeleteActionAllowed} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />Delete PO
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete PO {po.poNumber}.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(po.id!, po.poNumber)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                            {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
});
PurchaseOrderCard.displayName = 'PurchaseOrderCard';
