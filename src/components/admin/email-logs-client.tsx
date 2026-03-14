
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, ArrowLeft, Loader2, Search, ArrowDownUp } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import type { EmailLog } from '@/types/server-only';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import EmailLogsLoadingSkeleton from '@/app/dashboard/admin/email-logs/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const formatDate = (timestamp: string) => {
  try {
    return format(parseISO(timestamp), 'dd MMM yyyy, hh:mm:ss a');
  } catch (e) {
    return timestamp;
  }
};

const statusColors: Record<string, string> = {
    sent: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    simulated: "bg-blue-100 text-blue-800",
};

export default function EmailLogsClient() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof EmailLog; direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchLogs = useCallback(async () => {
    if (!user || !isAdmin) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/email-logs', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }
      const logsData: EmailLog[] = await response.json();
      setLogs(logsData);
    } catch (error: any) {
      console.error("Error fetching email logs for admin:", error);
      toast({ title: "Error Loading Logs", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, isAdmin, toast]);
  
  useEffect(() => {
    if (!authLoading) {
      fetchLogs();
    }
  }, [authLoading, fetchLogs]);

  const sortedAndFilteredLogs = useMemo(() => {
    let filtered = logs.filter(log => {
        const searchTermLower = searchTerm.toLowerCase();
        return (
            log.to.toLowerCase().includes(searchTermLower) ||
            log.subject.toLowerCase().includes(searchTermLower) ||
            log.status.toLowerCase().includes(searchTermLower)
        );
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (sortConfig.key === 'timestamp') {
            return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [logs, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredLogs.length / itemsPerPage);
  const paginatedLogs = sortedAndFilteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('_') as [keyof EmailLog, 'asc' | 'desc'];
    setSortConfig({ key, direction });
  };


  if (isLoading || authLoading) {
    return <EmailLogsLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Mail className="mr-3 h-7 w-7 text-primary" /> Admin: Email Log
          </h1>
          <p className="text-muted-foreground">History of all emails sent from the system.</p>
        </div>
         <Button variant="outline" asChild>
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
          </Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>System Email History</CardTitle>
          <div className="pt-2">
            <Input
              placeholder="Search by recipient, subject, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.length > 0 ? (
                    paginatedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                        <TableCell>{log.from}</TableCell>
                        <TableCell>{log.to}</TableCell>
                        <TableCell className="font-medium">{log.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("capitalize", statusColors[log.status] || '')}>{log.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center h-24">No email logs found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
         {sortedAndFilteredLogs.length > 0 && (
          <CardFooter className="border-t pt-2">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }}
              canPreviousPage={currentPage > 1}
              canNextPage={currentPage < totalPages}
              itemCount={logs.length}
              filteredItemCount={sortedAndFilteredLogs.length}
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
