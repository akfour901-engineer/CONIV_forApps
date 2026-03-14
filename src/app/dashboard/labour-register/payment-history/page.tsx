
'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { IndianRupee, ArrowLeft, Search, ArrowDownUp, ExternalLink, DownloadCloud } from "lucide-react";
import Link from 'next/link';
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import type { LabourAdvance } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import LabourPaymentHistoryLoading from './loading';
import { useLoading } from '@/contexts/loading-context';
import { useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

const formatDate = (isoString: string | undefined) => {
    if (!isoString) return 'N/A';
    try { return format(parseISO(isoString), 'dd MMM yyyy, p'); }
    catch (e) { return 'Invalid Date'; }
};

interface TransactionCardProps {
  tx: LabourAdvance;
}

const TransactionCard = React.memo(({ tx }: TransactionCardProps) => {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-md">To: {tx.labourerName}</CardTitle>
                <CardDescription className="text-xs">{formatDate(tx.date)}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
                 <p><span className="font-medium">Amount Paid:</span> {formatCurrency(tx.amount)}</p>
                 <p><span className="font-medium">Work Order:</span> {tx.workOrderNumber}</p>
                 <p className="text-xs text-muted-foreground pt-1 truncate" title={tx.description || undefined}>Description: {tx.description || 'N/A'}</p>
                 {tx.documentUrl && 
                    <a 
                        href={tx.documentUrl} 
                        download={`PaymentProof_${tx.labourerName?.replace(' ','_')}_${tx.date}`}
                        className={cn(buttonVariants({ variant: 'link', size: 'sm'}), "p-0 h-auto text-xs mt-1 flex items-center")}>
                        <DownloadCloud className="mr-1 h-3 w-3"/>
                        Download Document
                    </a>
                 }
            </CardContent>
        </Card>
    );
});
TransactionCard.displayName = 'TransactionCard';


function PaymentHistoryContent() {
  const { user, loading: authLoading, dataOwnerId } = useAuth();
  const [paymentHistory, setPaymentHistory] = useState<LabourAdvance[]>([]);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof LabourAdvance; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const labourerIdFilter = searchParams?.get('labourerId') ?? '';

  const fetchHistory = useCallback(async () => {
    if (!user || !dataOwnerId) {
        setIsLoadingHistory(false);
        return;
    }
    setIsLoadingHistory(true);
    try {
      const idToken = await user.getIdToken();
      let url = `/api/labour-advances?dataOwnerId=${dataOwnerId}`;
      if (labourerIdFilter) {
          url += `&labourerId=${labourerIdFilter}`;
      }
      const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${idToken}` }
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch payment history.');
      }

      const data: LabourAdvance[] = await response.json();
      setPaymentHistory(data);
    } catch (error: any) {
      console.error("Error fetching payment history:", error);
      toast({ title: "Error", description: `Could not load payment history: ${error.message}`, variant: "destructive" });
    }
    setIsLoadingHistory(false);
  }, [user, dataOwnerId, labourerIdFilter, toast, setIsLoadingHistory]);

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
        (tx.labourerName && tx.labourerName.toLowerCase().includes(searchTermLower)) ||
        (tx.workOrderNumber && tx.workOrderNumber.toLowerCase().includes(searchTermLower)) ||
        (tx.description && tx.description.toLowerCase().includes(searchTermLower))
      );
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (sortConfig.key === 'date') {
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
      const [key, direction] = value.split('_') as [keyof LabourAdvance, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };

  if(authLoading || isLoadingHistory){
      return <LabourPaymentHistoryLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <IndianRupee className="mr-3 h-7 w-7 text-primary" /> Labour Payment History
          </h1>
          <p className="text-muted-foreground">
            Review all advances and payments made to your labourers.
          </p>
        </div>
         <Button variant="outline" asChild>
          <Link href="/dashboard/labour-register">
            <span className="flex items-center"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Labour Register</span>
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
          <CardDescription>
            Your history of payments made to labourers. {labourerIdFilter ? `(Filtered for one labourer)` : ''}
          </CardDescription>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by Name, WO#, Desc..."
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
                <SelectItem value="date_desc">Date: Newest</SelectItem>
                <SelectItem value="date_asc">Date: Oldest</SelectItem>
                <SelectItem value="amount_desc">Amount: High-Low</SelectItem>
                <SelectItem value="labourerName_asc">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (<LabourPaymentHistoryLoading />) : paginatedHistory.length === 0 ? (
             <div className="text-center py-12">
              <IndianRupee className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-lg font-medium">No Payment History Yet</p>
              <p className="text-sm text-muted-foreground">
                Payments made to labourers will be logged here.
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
                            <TableHead>Labourer Name</TableHead>
                            <TableHead>Work Order #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Doc</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedHistory.map((tx) => (
                            <TableRow key={tx.id}>
                                <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                                <TableCell>{tx.labourerName}</TableCell>
                                <TableCell>{tx.workOrderNumber}</TableCell>
                                <TableCell className="truncate max-w-xs">{tx.description || 'N/A'}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(tx.amount)}</TableCell>
                                <TableCell className="text-center">
                                    {tx.documentUrl && 
                                        <a 
                                            href={tx.documentUrl} 
                                            download={`PaymentProof_${tx.labourerName?.replace(' ','_')}_${tx.date}`}
                                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), "h-7 w-7")}
                                        >
                                            <DownloadCloud className="h-4 w-4"/>
                                        </a>
                                    }
                                </TableCell>
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
            onItemsPerPageChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
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

export default function LabourPaymentHistoryPage() {
    return (
        <Suspense fallback={<LabourPaymentHistoryLoading />}>
            <PaymentHistoryContent />
        </Suspense>
    )
}

    