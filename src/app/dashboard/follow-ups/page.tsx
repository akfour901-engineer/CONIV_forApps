
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, MessageSquare, Edit, Trash2, Loader2, Search, AlertTriangle, ArrowDownUp } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { FollowUp } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useLoading } from '@/contexts/loading-context';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import FollowUpsLoadingSkeleton from './loading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy'); }
  catch (e) { return 'Invalid Date'; }
};

const statusBadgeVariant = (status: FollowUp['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        case 'pending': return 'secondary';
        case 'completed': return 'default';
        case 'cancelled': return 'destructive';
        default: return 'outline';
    }
};

interface FollowUpCardProps {
    item: FollowUp;
    onDelete: (id: string) => void;
    isDeleting: boolean;
    currentDeletingId: string | null;
    canManage: boolean;
    setGlobalIsLoading: (loading: boolean) => void;
}

const FollowUpCard = React.memo(({ item, onDelete, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: FollowUpCardProps) => (
    <Card className="shadow-sm">
        <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
                <CardTitle className="text-md line-clamp-2">{item.organizationName}</CardTitle>
                <Badge variant={statusBadgeVariant(item.status)} className="capitalize text-xs whitespace-nowrap flex-shrink-0">{item.status}</Badge>
            </div>
            <CardDescription className="text-xs">Reminder on: {formatDate(item.reminderDate)}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm pt-2 pb-3 space-y-1">
            <p><span className="font-medium">Contact:</span> {item.contactPerson || 'N/A'}</p>
            <p><span className="font-medium">Visit Date:</span> {formatDate(item.visitDate)}</p>
            <p className="text-muted-foreground pt-1 line-clamp-3" title={item.notes || ""}>
                <span className="font-medium text-foreground">Notes:</span> {item.notes || 'N/A'}
            </p>
        </CardContent>
        <CardFooter className="flex justify-end gap-1 pt-2 pb-3 border-t">
             <Button variant="outline" size="sm" className="text-xs" asChild disabled={!canManage} title={!canManage ? "Permission Denied" : "Edit Follow-up"} onClick={() => setGlobalIsLoading(true)}>
              <Link href={`/dashboard/follow-ups/${item.id}/edit`} className="flex items-center">
                <Edit className="mr-1 h-3 w-3" />Edit
              </Link>
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="text-xs" disabled={!canManage || (isDeleting && currentDeletingId === item.id)} title={!canManage ? "Permission Denied" : "Delete Follow-up"}>
                        <span className="flex items-center">
                            {(isDeleting && currentDeletingId === item.id) ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                            Delete
                        </span>
                    </Button>
                </AlertDialogTrigger>
                 <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting && currentDeletingId === item.id}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(item.id!)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting && currentDeletingId === item.id}>
                            <span className="flex items-center">
                                {(isDeleting && currentDeletingId === item.id) ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="mr-2 h-4 w-4" /> Delete</>}
                            </span>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
    </Card>
));
FollowUpCard.displayName = 'FollowUpCard';


export default function FollowUpsPage() {
  const { user, dataOwnerId, loading: authLoading, currentTeamMemberPermissions, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof FollowUp; direction: 'asc' | 'desc' }>({ key: 'reminderDate', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const canManageFollowUps = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOrganizations;

  const fetchFollowUps = useCallback(async () => {
    if (!user || !dataOwnerId) {
      setIsLoading(false);
      return;
    }
    if (!canManageFollowUps) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/follow-ups?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch follow-ups.');
      setFollowUps(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast, canManageFollowUps]);

  useEffect(() => {
    if (!authLoading) fetchFollowUps();
  }, [authLoading, fetchFollowUps]);

  const handleDelete = async (followUpId: string) => {
    if (!user) return;
    setIsDeleting(true);
    setCurrentDeletingId(followUpId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/follow-ups/${followUpId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` }});
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete follow-up.');
      toast({ title: "Success", description: "Follow-up deleted." });
      fetchFollowUps();
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setCurrentDeletingId(null);
    }
  };

  const sortedAndFilteredItems = useMemo(() => {
    let filtered = followUps.filter(item => {
      const term = searchTerm.toLowerCase();
      return (
        item.organizationName.toLowerCase().includes(term) ||
        (item.contactPerson && item.contactPerson.toLowerCase().includes(term)) ||
        (item.notes && item.notes.toLowerCase().includes(term))
      );
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (sortConfig.key === 'visitDate' || sortConfig.key === 'reminderDate') {
          return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return (aValue ?? "").localeCompare(bValue ?? "") * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [followUps, searchTerm, sortConfig]);
  
  const paginatedItems = sortedAndFilteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(sortedAndFilteredItems.length / itemsPerPage);

  const handleSort = (key: keyof FollowUp) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  if (isLoading || authLoading) {
    return <FollowUpsLoadingSkeleton />;
  }

  if (!canManageFollowUps) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="w-16 h-16 text-destructive mb-4" /><h2 className="text-xl font-semibold">Permission Denied</h2><p className="text-muted-foreground">You do not have permission to manage follow-ups.</p><Button asChild className="mt-6"><Link href="/dashboard">Back to Dashboard</Link></Button></div> );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><MessageSquare className="mr-3 h-7 w-7 text-primary"/> Follow-ups & Reminders</h1><p className="text-muted-foreground">Track your client interactions and set reminders for follow-ups.</p></div>
        <Button asChild className="w-full sm:w-auto" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/follow-ups/new"><PlusCircle className="mr-2 h-5 w-5"/> Add New Follow-up</Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Follow-up Log</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground"/>} />
          </div>
        </CardHeader>
        <CardContent>
            {/* Mobile View */}
            <div className="md:hidden grid gap-4 sm:grid-cols-2">
              {paginatedItems.length > 0 ? (
                paginatedItems.map(item => (
                  <FollowUpCard 
                    key={item.id} 
                    item={item} 
                    onDelete={handleDelete} 
                    isDeleting={isDeleting} 
                    currentDeletingId={currentDeletingId} 
                    canManage={canManageFollowUps}
                    setGlobalIsLoading={setGlobalIsLoading}
                  />
                ))
              ) : (
                <div className="text-center py-12 col-span-full"><MessageSquare className="mx-auto h-12 w-12 text-muted-foreground"/><p className="mt-4 text-lg font-medium">No Follow-ups Found</p></div>
              )}
            </div>

            {/* Desktop View */}
             <div className="hidden md:block">
              {paginatedItems.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <DataTableColumnHeader title="Organization" onSort={() => handleSort('organizationName')} sortConfig={sortConfig} sortKey="organizationName" />
                        <DataTableColumnHeader title="Reminder Date" onSort={() => handleSort('reminderDate')} sortConfig={sortConfig} sortKey="reminderDate" />
                        <DataTableColumnHeader title="Contact Person" onSort={() => handleSort('contactPerson')} sortConfig={sortConfig} sortKey="contactPerson" />
                        <TableHead>Notes</TableHead>
                        <DataTableColumnHeader title="Status" onSort={() => handleSort('status')} sortConfig={sortConfig} sortKey="status" />
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedItems.map(item => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.organizationName}</TableCell>
                            <TableCell className="font-bold text-amber-600">{formatDate(item.reminderDate)}</TableCell>
                            <TableCell>{item.contactPerson || 'N/A'}</TableCell>
                            <TableCell className="max-w-sm truncate" title={item.notes || ""}>{item.notes || 'N/A'}</TableCell>
                            <TableCell><Badge variant={statusBadgeVariant(item.status)} className="capitalize">{item.status}</Badge></TableCell>
                            <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/follow-ups/${item.id}/edit`}><Edit className="h-4 w-4"/></Link></Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={isDeleting && currentDeletingId === item.id}>
                                    {isDeleting && currentDeletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete Follow-up?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item.id!)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
              ) : (
                <div className="text-center py-12"><MessageSquare className="mx-auto h-12 w-12 text-muted-foreground"/><p className="mt-4 text-lg font-medium">No Follow-ups Found</p></div>
              )}
            </div>
        </CardContent>
        {sortedAndFilteredItems.length > 0 && (
          <CardFooter className="border-t pt-2">
            <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={followUps.length} filteredItemCount={sortedAndFilteredItems.length} />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
