'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CreditCard, ArrowLeft, Loader2, FileClock, ArrowDownUp, Search, Coins, DownloadCloud, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import type { PaymentTransaction } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import PaymentHistoryLoading from './loading';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useLoading } from '@/contexts/loading-context';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const formatDate = (isoString: string | undefined) => {
    if (!isoString) return 'N/A';
    try { return format(parseISO(isoString), 'dd MMM yyyy, p'); }
    catch (e) { return 'Invalid Date'; }
};

const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

const TransactionCard = React.memo(({ tx }: { tx: PaymentTransaction }) => {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-md">{tx.packageName}</CardTitle>
                <CardDescription className="text-xs">{formatDate(tx.transactionDate)}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
                 <p><span className="font-medium">Amount Paid:</span> {formatCurrency(tx.amountPaid)}</p>
                 <p><span className="font-medium">Points Awarded:</span> {tx.metadata?.paymentType === 'support_contribution' ? 'N/A' : tx.pointsAwarded}</p>
                 <p><span className="font-medium">Status:</span> <span className="capitalize">{tx.status}</span></p>
                 <p className="text-xs text-muted-foreground pt-1 truncate" title={tx.paymentId}>Payment ID: {tx.paymentId}</p>
            </CardContent>
        </Card>
    );
});
TransactionCard.displayName = 'TransactionCard';


export default function PaymentHistoryPage() {
  const { user, loading: authLoading, dataOwnerId } = useAuth();
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const { setIsLoading } = useLoading();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof PaymentTransaction; direction: 'asc' | 'desc' } | null>({ key: 'transactionDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user || !dataOwnerId) {
        setIsLoadingHistory(false);
        return;
    }
    setIsLoadingHistory(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/payment-history?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch payment history.');
      }

      const data: PaymentTransaction[] = await response.json();
      setPaymentHistory(data);
    } catch (error: any) {
      console.error("Error fetching payment history:", error);
      toast({ title: "Error", description: `Could not load payment history: ${error.message}`, variant: "destructive" });
    }
    setIsLoadingHistory(false);
  }, [user, dataOwnerId, toast, setIsLoadingHistory]);

  useEffect(() => {
    if (!authLoading && user && dataOwnerId) {
      fetchHistory();
    } else if (!authLoading) {
        setIsLoadingHistory(false);
    }
  }, [user, dataOwnerId, authLoading, fetchHistory]);

  const sortedAndFilteredHistory = useMemo(() => {
    let filtered = paymentHistory.filter(tx => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        tx.packageName.toLowerCase().includes(searchTermLower) ||
        tx.paymentId.toLowerCase().includes(searchTermLower) ||
        tx.orderId.toLowerCase().includes(searchTermLower)
      );
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (sortConfig.key === 'transactionDate') {
            return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
         if (typeof aValue === 'number' && typeof bValue === 'number') {
           return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [paymentHistory, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredHistory.length / itemsPerPage);
  const paginatedHistory = sortedAndFilteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof PaymentTransaction, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };

  if(authLoading || isLoadingHistory){
      return <PaymentHistoryLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <CreditCard className="mr-3 h-7 w-7 text-primary" /> Payment History
          </h1>
          <p className="text-muted-foreground">
            Review your past transactions for purchasing resource points.
          </p>
        </div>
         <Button variant="outline" asChild>
          <Link href="/dashboard/coins-payments">
            <span className="flex items-center"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Coins & Payments</span>
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
          <CardDescription>
            Your coin purchase and support transaction history.
          </CardDescription>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by Package, ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
             <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'none'}>
              <SelectTrigger className="w-full md:w-[180px]">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4" />
                  <SelectValue placeholder="Sort by..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transactionDate_desc">Date: Newest</SelectItem>
                <SelectItem value="transactionDate_asc">Date: Oldest</SelectItem>
                <SelectItem value="amountPaid_desc">Amount: High-Low</SelectItem>
                <SelectItem value="packageName_asc">Package (A-Z)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedHistory.length === 0 ? (
             <div className="text-center py-12">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-lg font-medium">No Payment History Yet</p>
              <p className="text-sm text-muted-foreground">
                Your coin purchase transactions will be logged here.
              </p>
            </div>
          ) : (
            <>
            <div className="md:hidden space-y-4">
              {paginatedHistory.map((tx) => <TransactionCard key={tx.id} tx={tx} />)}
            </div>
            <div className="hidden md:block overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                            <TableHead>Payment ID</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedHistory.map((tx) => (
                            <TableRow key={tx.id}>
                                <TableCell className="whitespace-nowrap">{formatDate(tx.transactionDate)}</TableCell>
                                <TableCell>{tx.packageName}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{formatCurrency(tx.amountPaid)}</TableCell>
                                <TableCell className="text-right">{tx.metadata?.paymentType === 'support_contribution' ? 'N/A' : tx.pointsAwarded}</TableCell>
                                <TableCell className="truncate max-w-[150px]" title={tx.paymentId}>{tx.paymentId}</TableCell>
                                <TableCell className="capitalize">{tx.status}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            </>
          )}
        </CardContent>
         <CardFooter className="border-t pt-2">
           <DataTablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            itemCount={paymentHistory.length}
            filteredItemCount={sortedAndFilteredHistory.length}
           />
        </CardFooter>
      </Card>
    </div>
  );
}
