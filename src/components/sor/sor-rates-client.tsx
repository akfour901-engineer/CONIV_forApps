
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, ListOrdered, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, Upload, Eye, Loader2, FileUp, ListFilter } from "lucide-react";
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { SorRate, TeamPermissions } from '@/types';
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
import SorRatesLoading from '@/app/dashboard/sor-rates/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';


const SorRateCard = React.memo(({ item, onDelete, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: { item: SorRate, onDelete: (id: string, name: string) => void, isDeleting: boolean, currentDeletingId: string | null, canManage: boolean, setGlobalIsLoading: (loading: boolean) => void }) => {
    return (
        <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-md line-clamp-2">{item.itemDescription}</CardTitle>
                    <Badge variant={item.visibility === 'public' ? 'secondary' : 'outline'} className="capitalize text-xs">{item.visibility}</Badge>
                </div>
                <CardDescription className="text-xs">{item.itemCode}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-0.5 pt-1 pb-2 flex-grow">
                <p><span className="font-medium">Unit:</span> {item.unit}</p>
                <p><span className="font-medium">Rate:</span> {formatCurrency(item.rate)}</p>
                {item.organizationName && <p className="text-xs text-muted-foreground pt-1">Specific to: {item.organizationName}</p>}
            </CardContent>
            <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
                <Button variant="ghost" size="sm" asChild onClick={() => setGlobalIsLoading(true)} disabled={!canManage}>
                    <Link href={`/dashboard/sor-rates/${item.id}/edit`}><Edit className="mr-1 h-3 w-3"/>Edit</Link>
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={!canManage || (isDeleting && currentDeletingId === item.id)}>
                            {isDeleting && currentDeletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the item `{item.itemCode}`.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(item.id!, item.itemCode)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    );
});
SorRateCard.displayName = 'SorRateCard';


export default function SorRatesClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [sorRates, setSorRates] = useState<SorRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof SorRate; direction: 'asc' | 'desc' } | null>({ key: 'itemCode', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const canManageOwnerSORs = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOwnerSORs;

  const fetchSorRates = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/sor-rates?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch SOR rates.');
      setSorRates(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load SOR rates: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchSorRates();
    }
  }, [authLoading, dataOwnerId, fetchSorRates]);

  const handleDelete = async (itemId: string, itemCode: string) => {
    if (!canManageOwnerSORs) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
    setIsDeleting(true); setCurrentDeletingId(itemId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/sor-rates/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete item.');
      toast({ title: "Success", description: `SOR item ${itemCode} deleted.` });
      fetchSorRates(); // Refetch data to show the updated list
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete item: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };

  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof SorRate, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };
  
  const sortedAndFilteredItems = useMemo(() => {
    let filtered = sorRates.filter(item => 
        (visibilityFilter === 'all' || item.visibility === visibilityFilter) &&
        (
            item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.organizationName && item.organizationName.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    );

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal as string) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [sorRates, searchTerm, sortConfig, visibilityFilter]);

  const totalPages = Math.ceil(sortedAndFilteredItems.length / itemsPerPage);
  const paginatedItems = sortedAndFilteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) return <SorRatesLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><ListOrdered className="mr-3 h-7 w-7 text-primary" /> Schedule of Rates (SOR)</h1><p className="text-muted-foreground">Manage your standard and client-specific item rates.</p></div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button asChild variant="outline" className="w-full sm:w-auto" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/sor-rates/bulk-import"><FileUp className="mr-2 h-4 w-4"/>Bulk Import</Link></Button>
          <Button asChild className="w-full sm:w-auto" disabled={!canManageOwnerSORs} onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/sor-rates/new"><PlusCircle className="mr-2 h-5 w-5"/>Add New Rate</Link></Button>
        </div>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your SOR Items</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search by Code, Description, Organization..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
            <Select onValueChange={(value) => { setVisibilityFilter(value); setCurrentPage(1); }} defaultValue="all">
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ListFilter className="h-4 w-4" /><SelectValue placeholder="Filter by Visibility" /></div></SelectTrigger>
              <SelectContent><SelectItem value="all">All Visibilities</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="public">Public</SelectItem></SelectContent>
            </Select>
            <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'itemCode_asc'}>
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent><SelectItem value="itemCode_asc">Code (A-Z)</SelectItem><SelectItem value="rate_desc">Rate (High-Low)</SelectItem><SelectItem value="updatedAt_desc">Last Modified</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
            <div className="md:hidden grid gap-4 sm:grid-cols-2">
                {paginatedItems.length > 0 ? paginatedItems.map(item => <SorRateCard key={item.id} item={item} onDelete={handleDelete} isDeleting={isDeleting} currentDeletingId={currentDeletingId} canManage={canManageOwnerSORs} setGlobalIsLoading={setGlobalIsLoading} />) : <p className="text-muted-foreground text-center py-8 col-span-full">No SOR items found.</p>}
            </div>
            <div className="hidden md:block">
              {paginatedItems.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Description</TableHead><TableHead>Unit</TableHead><TableHead>Organization</TableHead><TableHead>Visibility</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {paginatedItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono">{item.itemCode}</TableCell>
                                <TableCell className="font-medium max-w-xs truncate" title={item.itemDescription}>{item.itemDescription}</TableCell>
                                <TableCell>{item.unit}</TableCell>
                                <TableCell>{item.organizationName || 'N/A'}</TableCell>
                                <TableCell><Badge variant={item.visibility === 'public' ? 'secondary' : 'outline'} className="capitalize">{item.visibility}</Badge></TableCell>
                                <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGlobalIsLoading(true)} disabled={!canManageOwnerSORs}><Link href={`/dashboard/sor-rates/${item.id}/edit`}><Edit className="h-4 w-4"/></Link></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManageOwnerSORs || (isDeleting && currentDeletingId === item.id)}>
                                            {isDeleting && currentDeletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                        </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the SOR item `{item.itemCode}`.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id!, item.itemCode)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
              ) : <p className="text-center py-12 text-muted-foreground">No SOR items found.</p>}
            </div>
        </CardContent>
        {sortedAndFilteredItems.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-2">
            <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={sorRates.length} filteredItemCount={sortedAndFilteredItems.length}/>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
