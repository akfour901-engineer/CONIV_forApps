
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CreditCard, ArrowLeft, Loader2, FileClock, ArrowDownUp, Search, Coins, BarChartHorizontalBig } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import type { ActivityLog } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import UsageHistoryLoading from './loading';
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useLoading } from '@/contexts/loading-context';
import { ACTION_COSTS_DISPLAY, APP_NAME } from '@/lib/constants';

const formatDate = (isoString: string | undefined) => {
  if (!isoString) return 'N/A';
  try { return format(parseISO(isoString), 'dd MMM yyyy, p'); }
  catch (e) { return 'Invalid Date'; }
};

const getPointChangeFromDetails = (details: string | Record<string, any> | undefined): { text: string; isCredit: boolean } => {
  if (details && typeof details === 'object') {
      if ('cost' in details && typeof details.cost === 'number' && details.cost > 0) {
          return { text: `-${details.cost}`, isCredit: false };
      }
      if ('pointsAwarded' in details && typeof details.pointsAwarded === 'number') {
          return { text: `+${details.pointsAwarded}`, isCredit: true };
      }
  }
  return { text: 'N/A', isCredit: false };
};

const getReadableAction = (log: ActivityLog): string => {
  if (log.details && typeof log.details === 'object' && 'message' in log.details && typeof log.details.message === 'string') {
      return log.details.message;
  }
  if (log.actionType === 'coin_purchase_success' && log.entityName) {
      return log.entityName;
  }

  let action = log.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if(log.entityName) {
      action += ` (${log.entityName})`;
  } else if (log.entityId) {
      action += ` (ID: ${log.entityId.substring(0,8)}...)`;
  }
  return action;
};

const UsageCard = React.memo(({ log }: { log: ActivityLog }) => {
    const pointChange = getPointChangeFromDetails(log.details);
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-md">{getReadableAction(log)}</CardTitle>
                    <span className={cn(
                        "text-lg font-semibold whitespace-nowrap",
                        pointChange.isCredit ? "text-green-600" : "text-red-600"
                    )}>
                        {pointChange.text}
                    </span>
                </div>
                <CardDescription className="text-xs">
                    {formatDate(log.timestamp)} by {log.actorName}
                </CardDescription>
            </CardHeader>
        </Card>
    );
});
UsageCard.displayName = 'UsageCard';

export default function UsageHistoryPage() {
  const { user, dataOwnerId, loading: authLoading, appConfig } = useAuth();
  const [usageHistory, setUsageHistory] = useState<ActivityLog[]>([]);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ActivityLog; direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsageHistory = useCallback(async () => {
    if (!user || !dataOwnerId) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/usage-history?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch usage history.');
      }
      const data: ActivityLog[] = await response.json();
      setUsageHistory(data);
    } catch (error: any) {
      console.error("Error fetching usage history:", error);
      toast({ title: "Error", description: `Could not load usage history: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast, setIsLoading]);

  useEffect(() => {
    if (!authLoading && user && dataOwnerId) {
      fetchUsageHistory();
    } else if (!authLoading) {
        setIsLoading(false);
    }
  }, [user, dataOwnerId, authLoading, fetchUsageHistory]);

  const sortedAndFilteredHistory = useMemo(() => {
    let filtered = usageHistory.filter(log => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        getReadableAction(log).toLowerCase().includes(searchTermLower) ||
        log.actorName.toLowerCase().includes(searchTermLower)
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
         if (typeof aValue === 'number' && typeof bValue === 'number') {
           return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [usageHistory, searchTerm, sortConfig]);

  const displayActionCosts = useMemo(() => {
    if (!appConfig?.actionCosts) return [];
    const costsMap = new Map(appConfig.actionCosts.map(c => [c.key, c.cost]));
    
    return ACTION_COSTS_DISPLAY
      .map(displayItem => ({ ...displayItem, cost: costsMap.get(displayItem.key) ?? 0 }))
      .filter(cost => cost.key !== 'DAILY_CHECK_IN_REWARD');
  }, [appConfig]);

  const totalPages = Math.ceil(sortedAndFilteredHistory.length / itemsPerPage);
  const paginatedHistory = sortedAndFilteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof ActivityLog, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };

  if(isLoading || authLoading){
      return <UsageHistoryLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <FileClock className="mr-3 h-7 w-7 text-primary" /> Points Transaction History
          </h1>
          <p className="text-muted-foreground">
            A complete log of your resource point additions and deductions.
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
            History of all actions that added or consumed resource points.
          </CardDescription>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by Action, Actor..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
             <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'timestamp_desc'}>
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent>
                <SelectItem value="timestamp_desc">Date: Newest</SelectItem>
                <SelectItem value="timestamp_asc">Date: Oldest</SelectItem>
                <SelectItem value="actionType_asc">Action Type (A-Z)</SelectItem>
                <SelectItem value="actorName_asc">Actor (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (<UsageHistoryLoading/>) : paginatedHistory.length === 0 ? (
             <div className="text-center py-12">
              <FileClock className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-lg font-medium">No Transaction History Yet</p>
              <p className="text-sm text-muted-foreground">
                Your point transactions will be logged here.
              </p>
            </div>
          ) : (
            <>
                <div className="md:hidden space-y-4">
                    {paginatedHistory.map((log) => (<UsageCard key={log.id} log={log} />))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Action / Details</TableHead>
                                <TableHead className="text-right">Points Change</TableHead>
                                <TableHead>Actor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedHistory.map((log) => {
                                const pointChange = getPointChangeFromDetails(log.details);
                                return (
                                    <TableRow key={log.id}>
                                        <TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                                        <TableCell>{getReadableAction(log)}</TableCell>
                                        <TableCell className={cn(
                                            "text-right font-semibold whitespace-nowrap",
                                            pointChange.isCredit ? "text-green-600" : "text-red-600"
                                        )}>
                                            {pointChange.text}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">{log.actorName}</TableCell>
                                    </TableRow>
                                )
                            })}
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
            itemCount={usageHistory.length}
            filteredItemCount={sortedAndFilteredHistory.length}
           />
        </CardFooter>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary"/> Action Cost Breakdown</CardTitle>
          <CardDescription>
            A reference list for how many resource points each action consumes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70%]">Action</TableHead>
                  <TableHead className="text-right">Cost (Points)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayActionCosts.length > 0 ? (
                  displayActionCosts.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-right">{item.cost}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No cost information configured.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Note: Costs are based on current configuration. Admins can configure these in the App Configuration settings.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
      
    
