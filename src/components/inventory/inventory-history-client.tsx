'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, History, Search, ArrowDownUp, DownloadCloud } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { InventoryTransaction } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useLoading } from '@/contexts/loading-context';
import InventoryHistoryLoading from '@/app/dashboard/inventory/history/loading';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy, p'); }
  catch (e) { return dateString; }
};

export default function InventoryHistoryClientPage() {
  const { user, dataOwnerId, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const canManageInventory = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageInventory, [isViewingOwnAccount, currentTeamMemberPermissions]);

  const fetchHistory = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageInventory) {
      if (!authLoading && !canManageInventory) toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false); return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/inventory/transaction-history?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch history.');
      setTransactions(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast, canManageInventory, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchHistory();
    }
  }, [authLoading, fetchHistory]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const term = searchTerm.toLowerCase();
      return (
        tx.inventoryItemName.toLowerCase().includes(term) ||
        tx.type.toLowerCase().includes(term) ||
        (tx.workOrderNumber && tx.workOrderNumber.toLowerCase().includes(term)) ||
        (tx.purchaseOrderId && tx.purchaseOrderId.toLowerCase().includes(term)) ||
        (tx.remarks && tx.remarks.toLowerCase().includes(term)) ||
        (tx.createdByName && tx.createdByName.toLowerCase().includes(term))
      );
    });
  }, [transactions, searchTerm]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) return <InventoryHistoryLoading />;
  if (!canManageInventory) return <div>Access Denied</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <History className="mr-3 h-7 w-7 text-primary" /> Inventory Transaction History
          </h1>
          <p className="text-muted-foreground">A complete log of all stock movements.</p>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/inventory">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
          <div className="pt-2">
            <Input
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty Change</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-center">Doc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.transactionDate)}</TableCell>
                      <TableCell className="font-medium">{tx.inventoryItemName}</TableCell>
                      <TableCell>
                        <span className={cn("font-semibold", tx.type === 'issue' ? 'text-red-600' : 'text-green-600')}>
                          {tx.type === 'issue' ? 'Issued' : 'Received'}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", tx.type === 'issue' ? 'text-red-600' : 'text-green-600')}>
                        {tx.type === 'issue' ? '-' : '+'}{tx.quantityChange}
                      </TableCell>
                      <TableCell>{tx.workOrderNumber || tx.purchaseOrderId || 'N/A'}</TableCell>
                      <TableCell>{tx.createdByName}</TableCell>
                      <TableCell className="truncate max-w-xs">{tx.remarks || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        {tx.documentUrl ? (
                            <a href={tx.documentUrl} download={`doc_${tx.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), "h-7 w-7")}>
                                <DownloadCloud className="h-4 w-4" />
                            </a>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={8} className="text-center h-24">No transactions found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {filteredTransactions.length > 0 && (
          <CardFooter className="border-t pt-4">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
              canPreviousPage={currentPage > 1}
              canNextPage={currentPage < totalPages}
              itemCount={transactions.length}
              filteredItemCount={filteredTransactions.length}
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}