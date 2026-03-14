
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Package, Eye, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, ArrowUp, ArrowDown, History, DollarSign, TrendingUp, Archive } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { InventoryItem, TeamPermissions } from '@/types';
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
import InventoryLoadingSkeleton from '@/app/dashboard/inventory/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { InventoryTransactionDialog } from './inventory-transaction-dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription as UIAlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ItemCardProps {
  item: InventoryItem;
  onDelete: (itemId: string, itemName: string) => void;
  onOpenTransactionDialog: (item: InventoryItem, type: 'issue' | 'receive') => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const ItemCard = React.memo(({ item, onDelete, onOpenTransactionDialog, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: ItemCardProps) => {
    const isLowStock = typeof item.quantityOnHand === 'number' && typeof item.lowStockThreshold === 'number' && item.quantityOnHand <= item.lowStockThreshold;
    
    return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow flex flex-col h-full", isLowStock && "border-amber-500/50 ring-1 ring-amber-500/20")}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-md line-clamp-2">{item.name}</CardTitle>
            {isLowStock && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0"/>}
        </div>
        <CardDescription className="text-xs">{item.category || 'Uncategorized'}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1 flex-grow">
        <p><span className="font-medium">SKU:</span> {item.sku || 'N/A'}</p>
        <p><span className="font-medium">Selling Price:</span> {formatCurrency(item.sellingPrice)}</p>
        <p><span className="font-medium">Qty on Hand:</span> {item.quantityOnHand ?? 'N/A'}</p>
        <p className="text-xs text-muted-foreground">Threshold: {item.lowStockThreshold ?? 'Not set'}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
        <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenTransactionDialog(item, 'issue')} disabled={!canManage}><ArrowDown className="mr-1 h-3 w-3 text-red-500"/>Issue</Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenTransactionDialog(item, 'receive')} disabled={!canManage}><ArrowUp className="mr-1 h-3 w-3 text-green-500"/>Receive</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={() => setGlobalIsLoading(true)} disabled={!canManage}><Link href={`/dashboard/inventory/${item.id}/edit`}><Edit className="h-4 w-4"/></Link></Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManage || (isDeleting && currentDeletingId === item.id)}>
              {isDeleting && currentDeletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete the item: {item.name}.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(item.id!, item.name)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
    );
});
ItemCard.displayName = 'ItemCard';


export default function InventoryClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [transactionType, setTransactionType] = useState<'issue' | 'receive'>('issue');

  const canManageInventory = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageInventory, [isViewingOwnAccount, currentTeamMemberPermissions]);

  const fetchItems = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageInventory) {
      if (!authLoading && !canManageInventory) toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false); return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/inventory?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch inventory.');
      setItems(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load inventory: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, canManageInventory, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchItems();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [dataOwnerId, authLoading, user, fetchItems]);

  const handleDelete = async (itemId: string, itemName: string) => {
    if (!canManageInventory) return;
    setIsDeleting(true); setCurrentDeletingId(itemId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/inventory/${itemId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete item.');
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast({ title: "Success", description: `${itemName} deleted.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete item: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };
  
  const handleOpenTransactionDialog = (item: InventoryItem, type: 'issue' | 'receive') => {
    setSelectedItem(item);
    setTransactionType(type);
    setIsTransactionDialogOpen(true);
  };

   const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof InventoryItem, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };
  
  const sortedAndFilteredItems = useMemo(() => {
    let filtered = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase())));
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key]; const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1; if (bValue === null || bValue === undefined) return -1;
        if (typeof aValue === 'number' && typeof bValue === 'number') { return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1); }
        if (typeof aValue === 'string' && typeof bValue === 'string') { return aValue.localeCompare(bValue as string) * (sortConfig.direction === 'asc' ? 1 : -1); }
        return 0;
      });
    }
    return filtered;
  }, [items, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredItems.length / itemsPerPage);
  const paginatedItems = sortedAndFilteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const lowStockItems = useMemo(() => items.filter(item => 
      typeof item.quantityOnHand === 'number' && 
      typeof item.lowStockThreshold === 'number' && 
      item.quantityOnHand <= item.lowStockThreshold
  ), [items]);

  const inventoryAnalytics = useMemo(() => {
    return {
      totalValue: items.reduce((sum, item) => sum + (item.quantityOnHand || 0) * (item.purchasePrice || 0), 0),
      potentialRevenue: items.reduce((sum, item) => sum + (item.quantityOnHand || 0) * item.sellingPrice, 0),
      totalSkus: items.length,
    };
  }, [items]);

  if (isLoading || authLoading) return <InventoryLoadingSkeleton />;
  if (!canManageInventory) return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="w-16 h-16 text-destructive mb-4" /><h2 className="text-xl font-semibold">Permission Denied</h2><p className="text-muted-foreground">You do not have permission to manage inventory.</p><Button asChild onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard">Back to Dashboard</Link></Button></div> );

  return (
    <>
      <InventoryTransactionDialog isOpen={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen} item={selectedItem} transactionType={transactionType} onTransactionComplete={fetchItems} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div><h1 className="text-2xl font-semibold flex items-center"><Package className="mr-3 h-7 w-7 text-primary" /> Inventory Management</h1><p className="text-muted-foreground">Track your materials, products, and services.</p></div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button asChild variant="outline" className="w-full sm:w-auto" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/inventory/history"><History className="mr-2 h-4 w-4"/>View History</Link></Button>
            <Button asChild className="w-full sm:w-auto" disabled={!canManageInventory} onClick={() => setGlobalIsLoading(true)}>
              <Link href="/dashboard/inventory/new"><PlusCircle className="mr-2 h-5 w-5" /> Add New Item</Link>
            </Button>
          </div>
        </div>
        
         <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(inventoryAnalytics.totalValue)}</div><p className="text-xs text-muted-foreground">Based on purchase price</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Potential Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(inventoryAnalytics.potentialRevenue)}</div><p className="text-xs text-muted-foreground">Based on selling price</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Item SKUs</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{inventoryAnalytics.totalSkus}</div><p className="text-xs text-muted-foreground">Unique items in inventory</p></CardContent>
          </Card>
        </div>


        {lowStockItems.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Low Stock Warning</AlertTitle>
            <UIAlertDescription>
              The following items are at or below their reorder threshold: {lowStockItems.map(item => `${item.name} (Qty: ${item.quantityOnHand})`).join(', ')}.
            </UIAlertDescription>
          </Alert>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Inventory</CardTitle>
            <div className="pt-2 flex flex-col md:flex-row gap-2">
              <Input placeholder="Search by Name, SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
              <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'name_asc'}>
                <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
                <SelectContent><SelectItem value="name_asc">Name (A-Z)</SelectItem><SelectItem value="quantityOnHand_asc">Quantity (Low-High)</SelectItem><SelectItem value="sellingPrice_desc">Price (High-Low)</SelectItem></SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="md:hidden grid gap-4 sm:grid-cols-2">
                {paginatedItems.length > 0 ? paginatedItems.map(item => <ItemCard key={item.id} item={item} onDelete={handleDelete} onOpenTransactionDialog={handleOpenTransactionDialog} isDeleting={isDeleting} currentDeletingId={currentDeletingId} canManage={canManageInventory} setGlobalIsLoading={setGlobalIsLoading}/>) : <p className="text-muted-foreground text-center py-8 col-span-full">No inventory items found.</p>}
            </div>
            <div className="hidden md:block">
              {paginatedItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="hidden lg:table-cell">SKU</TableHead><TableHead className="hidden md:table-cell">Category</TableHead><TableHead className="text-right">Selling Price</TableHead><TableHead className="text-right">Qty on Hand</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {paginatedItems.map((item) => {
                        const isLowStock = typeof item.quantityOnHand === 'number' && typeof item.lowStockThreshold === 'number' && item.quantityOnHand <= item.lowStockThreshold;
                        return (
                        <TableRow key={item.id} className={cn(isLowStock && "bg-amber-50 dark:bg-amber-800/20")}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="hidden lg:table-cell">{item.sku || 'N/A'}</TableCell>
                          <TableCell className="hidden md:table-cell">{item.category || 'N/A'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.sellingPrice)}</TableCell>
                          <TableCell className="text-right font-bold">{item.quantityOnHand ?? 'N/A'}</TableCell>
                          <TableCell>{item.unitOfMeasure}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenTransactionDialog(item, 'issue')} disabled={!canManageInventory}><ArrowDown className="mr-1 h-3 w-3 text-red-500"/>Issue</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleOpenTransactionDialog(item, 'receive')} disabled={!canManageInventory}><ArrowUp className="mr-1 h-3 w-3 text-green-500"/>Receive</Button>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGlobalIsLoading(true)} disabled={!canManageInventory}><Link href={`/dashboard/inventory/${item.id}/edit`}><Edit className="h-4 w-4"/></Link></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManageInventory || (isDeleting && currentDeletingId === item.id)}>{isDeleting && currentDeletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}</Button></AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the item: {item.name}.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id!, item.name)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>{isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-center py-12 text-muted-foreground">No inventory items found.</p>}
            </div>
          </CardContent>
          {sortedAndFilteredItems.length > 0 && (<CardFooter className="border-t pt-4"><DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={items.length} filteredItemCount={sortedAndFilteredItems.length}/></CardFooter>)}
        </Card>
      </div>
    </>
  );
}
