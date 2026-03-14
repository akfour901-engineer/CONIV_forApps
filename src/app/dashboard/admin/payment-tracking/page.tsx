
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, AlertTriangle, Loader2, ArrowLeft, Search, ArrowDownUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { PaymentTransaction } from '@/types';
import { format, parseISO } from 'date-fns';
import PaymentTrackingLoadingSkeleton from './loading';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useLoading } from '@/contexts/loading-context';

export default function AdminPaymentTrackingPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof PaymentTransaction; direction: 'asc' | 'desc' } | null>({ key: 'transactionDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      setIsLoadingHistory(false);
      if (!isAdmin && user) {
         toast({ title: "Access Denied", description: "You do not have permission to access this page.", variant: "destructive"});
      }
      return;
    }

    const fetchTransactions = async () => {
      setIsLoadingHistory(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/payment-transactions', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed: ${response.status}`);
        }
        const data: PaymentTransaction[] = await response.json();
        setTransactions(data);
      } catch (error:any) {
        console.error("Error fetching payment transactions for admin:", error);
        toast({ title: "Error Loading Transactions", description: error.message, variant: "destructive"});
      }
      setIsLoadingHistory(false);
    };

    fetchTransactions();
  }, [user, isAdmin, authLoading, toast]);
  
  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof PaymentTransaction, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };

  const sortedAndFilteredTransactions = useMemo(() => {
    let filtered = transactions.filter(tx => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        (tx.userName && tx.userName.toLowerCase().includes(searchTermLower)) ||
        tx.orderId.toLowerCase().includes(searchTermLower) ||
        tx.paymentId.toLowerCase().includes(searchTermLower) ||
        tx.packageName.toLowerCase().includes(searchTermLower)
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
  }, [transactions, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredTransactions.length / itemsPerPage);
  const paginatedTransactions = sortedAndFilteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const formatDate = (isoString: string | undefined) => {
    if (!isoString) return 'N/A';
    try { return format(parseISO(isoString), 'dd MMM yyyy, p'); }
    catch (e) { return 'Invalid Date'; }
  };


  if (authLoading) return <PaymentTrackingLoadingSkeleton />;

  if (!isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to access this page.</p>
            <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/admin">Back to Admin Panel</Link></Button>
        </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
                <CreditCard className="mr-3 h-7 w-7 text-primary" /> Payment Transaction Log (Admin)
            </h1>
            <p className="text-muted-foreground">
                Monitor all resource point purchase and support transactions made by users.
            </p>
          </div>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
            </Link>
          </Button>
        </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All System Transactions</CardTitle>
          <CardDescription>
            A log of all recorded payment transactions in the system.
          </CardDescription>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by User, Package, ID..."
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
                <SelectItem value="userName_asc">User Name (A-Z)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (<PaymentTrackingLoadingSkeleton />) : paginatedTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payment transactions found in the system yet.</p>
          ) : (
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User Name</TableHead>
                    <TableHead>Transaction Type</TableHead>
                    <TableHead>Package/Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Order ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.transactionDate)}</TableCell>
                      <TableCell className="truncate max-w-[150px]" title={tx.userName || tx.userId}>{tx.userName || tx.userId}</TableCell>
                      <TableCell className="capitalize">
                        {tx.metadata?.paymentType === 'support_contribution' ? 'Support' : 'Coin Purchase'}
                      </TableCell>
                      <TableCell>{tx.packageName}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(tx.amountPaid)}</TableCell>
                      <TableCell className="text-right">{tx.metadata?.paymentType === 'support_contribution' ? 'N/A' : tx.pointsAwarded}</TableCell>
                      <TableCell className="capitalize">{tx.status}</TableCell>
                      <TableCell className="truncate max-w-[120px]" title={tx.paymentId}>{tx.paymentId}</TableCell>
                      <TableCell className="truncate max-w-[120px]" title={tx.orderId}>{tx.orderId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
         {sortedAndFilteredTransactions.length > 0 && !isLoadingHistory && (
          <CardFooter className="border-t pt-2">
           <DataTablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            itemCount={transactions.length}
            filteredItemCount={sortedAndFilteredTransactions.length}
           />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
