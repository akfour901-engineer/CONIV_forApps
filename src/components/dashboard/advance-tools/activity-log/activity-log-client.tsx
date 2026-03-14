
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, ArrowLeft, Loader2, AlertTriangle, Coins, Search, ArrowDownUp } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import type { ActivityLog } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import ActivityLogLoadingSkeleton from '@/app/dashboard/advance-tools/activity-log/loading'; 
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

const formatDate = (timestamp: string) => { try { return format(parseISO(timestamp), 'dd MMM yyyy, hh:mm:ss a'); } catch (e) { return timestamp; } };

const renderLogDetails = (details: string | Record<string, any> | undefined) => {
    if (!details) return 'N/A'; if (typeof details === 'string') return details;
    if (typeof details === 'object') {
        const message = details.message || ''; const cost = details.cost;
        const hasDetails = !!message || (cost !== undefined && cost !== null);
        if (!hasDetails) return 'N/A';
        return (
            <div className="flex flex-col text-xs"> {message && <span>{message}</span>}
                {cost !== undefined && cost > 0 && ( <span className="text-red-600 flex items-center mt-0.5"><Coins className="mr-1 h-3 w-3" /> Cost: {cost} points</span> )}
            </div>
        );
    } return JSON.stringify(details);
};

const ActivityLogCard = React.memo(({ log }: { log: ActivityLog }) => {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-md capitalize">{log.actionType.replace(/_/g, ' ')}</CardTitle>
        <CardDescription className="text-xs">{formatDate(log.timestamp)} by {log.actorName}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <p><span className="font-medium">Entity:</span> {log.entityType}</p>
        <p><span className="font-medium">Reference:</span> {log.entityName || log.entityId || 'N/A'}</p>
        <div>
          <p className="font-medium">Details:</p>
          <div className="text-muted-foreground">{renderLogDetails(log.details)}</div>
        </div>
      </CardContent>
    </Card>
  );
});
ActivityLogCard.displayName = 'ActivityLogCard';


export default function ActivityLogClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount, currentTeamOwnerProfile } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const { setIsLoading: setIsLoadingGlobal } = useLoading();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ActivityLog; direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const canViewActivityLog = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewActivityLog;
  const currentContextName = isViewingOwnAccount ? "My Account" : (currentTeamOwnerProfile?.fullName || "Team Account");

  const fetchLogs = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); setLogs([]); return; }
    if (!canViewActivityLog) {
      setIsLoading(false); setLogs([]);
      toast({ title: "Permission Denied", description: "You do not have permission to view the activity log.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/dashboard/activity-log?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }
      
      const logsData: ActivityLog[] = await response.json();
      setLogs(logsData);
      
    } catch (error: any) {
      console.error("Error fetching activity logs (via API):", error);
      toast({ title: "Error Loading Logs", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [dataOwnerId, user, canViewActivityLog, toast, setIsLoading]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchLogs();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [dataOwnerId, authLoading, user, fetchLogs]);
  
  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig({ key: 'timestamp', direction: 'desc' });
    } else {
      const [key, direction] = value.split('_') as [keyof ActivityLog, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };

  const sortedAndFilteredLogs = useMemo(() => {
    let filtered = logs.filter(log => {
        const searchTermLower = searchTerm.toLowerCase();
        const detailsMessage = log.details && typeof log.details === 'object' && 'message' in log.details ? String(log.details.message).toLowerCase() : '';
        return (
            log.actorName.toLowerCase().includes(searchTermLower) ||
            log.actionType.replace(/_/g, ' ').toLowerCase().includes(searchTermLower) ||
            log.entityType.toLowerCase().includes(searchTermLower) ||
            (log.entityName && log.entityName.toLowerCase().includes(searchTermLower)) ||
            detailsMessage.includes(searchTermLower)
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
  
  if (authLoading || !userProfile) {
    return <ActivityLogLoadingSkeleton />;
  }
  if (!user) { return ( <div className="p-4 text-center"><p>Please sign in to view activity logs.</p><Button asChild className="mt-4" onClick={() => setGlobalIsLoading(true)}><Link href="/auth/signin">Sign In</Link></Button></div> ); }

  if (!canViewActivityLog && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" /> <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view the activity log.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/advance-tools">
                <span className="flex items-center">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools
                </span>
            </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div> <h1 className="text-2xl font-semibold flex items-center"><Activity className="mr-3 h-7 w-7 text-primary" /> Activity Log</h1> <p className="text-muted-foreground"> Viewing recent activities for: <span className="font-semibold text-primary">{currentContextName}</span> </p> </div>
        <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/advance-tools">
                <span className="flex items-center">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools
                </span>
            </Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader> <CardTitle>Log Entries</CardTitle> <CardDescription>Showing the latest activities for the selected account context.</CardDescription>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search logs..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
             <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'timestamp_desc'}>
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent><SelectItem value="timestamp_desc">Date: Newest</SelectItem><SelectItem value="timestamp_asc">Date: Oldest</SelectItem><SelectItem value="actorName_asc">Actor (A-Z)</SelectItem><SelectItem value="actionType_asc">Action Type (A-Z)</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? ( <ActivityLogLoadingSkeleton /> ) : paginatedLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{searchTerm ? "No logs match your search." : "No activity recorded yet for this account."}</p>
          ) : ( 
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {paginatedLogs.map((log) => (<ActivityLogCard key={log.id} log={log} />))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto"> 
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[180px]">Timestamp</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Entity Type</TableHead><TableHead>Entity Ref</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow key={log.id}><TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell><TableCell>{log.actorName}</TableCell><TableCell className="capitalize">{log.actionType.replace(/_/g, ' ')}</TableCell><TableCell>{log.entityType}</TableCell><TableCell className="max-w-[150px] truncate" title={log.entityName || log.entityId || undefined}>{log.entityName || log.entityId || 'N/A'}</TableCell><TableCell className="max-w-xs">{renderLogDetails(log.details)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div> 
            </>
          )}
        </CardContent>
         {sortedAndFilteredLogs.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-2">
             <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={logs.length} filteredItemCount={sortedAndFilteredLogs.length}/>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
