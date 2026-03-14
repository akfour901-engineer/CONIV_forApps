
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, ShoppingCart, Eye, Edit, Trash2, Copy, Search, Link as LinkIconOriginal, AlertTriangle, Settings2, UploadCloud, ArrowDownUp, Receipt, HardHat, Bot, Hammer, FileClock, Wrench, CreditCard, UserCog, FileArchive, Clock, ClipboardList, DownloadCloud, Store } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { ListingItem, ListingItemStatus, TeamPermissions } from '@/types';
import { LISTING_ITEM_TYPE_OPTIONS } from '@/types';
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
import BuySellExchangeLoading from '@/app/dashboard/advance-tools/buy-sell-exchange/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Image from 'next/image';

const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

interface ListingCardProps {
  listing: ListingItem;
  onDelete: (listingId: string, listingTitle: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const ListingCard = React.memo(({ listing, onDelete, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: ListingCardProps) => (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-lg line-clamp-2">{listing.title}</CardTitle>
            <Badge variant={listing.status === 'active' ? 'default' : 'secondary'} className="capitalize text-xs">{listing.status.replace(/_/g, " ")}</Badge>
        </div>
        <CardDescription className="text-xs">{listing.category || 'Uncategorized'}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-2 flex-grow">
          {listing.imageUrls && listing.imageUrls.length > 0 ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-md border">
              <Image src={listing.imageUrls[0]} alt={listing.title} layout="fill" objectFit="cover" data-ai-hint="product photo" />
            </div>
          ) : (
            <div className="aspect-video w-full bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs">No Image</div>
          )}
        <p className="font-semibold text-primary pt-2">{listing.itemType === 'sell' ? formatCurrency(listing.price) : (listing.itemType === 'buy' ? `Budget: ${formatCurrency(listing.price)}` : `Exchange For: ${listing.exchangeFor}`)}</p>
        <p className="text-xs text-muted-foreground">{listing.city || 'Location not specified'}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
        <Button variant="ghost" size="sm" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href={`/dashboard/advance-tools/buy-sell-exchange/${listing.id}`}>
                <Eye className="mr-1 h-3 w-3" /> View
            </Link>
        </Button>
        {canManage && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings2 className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                     <DropdownMenuItem asChild onClick={() => setGlobalIsLoading(true)}>
                        <Link href={`/dashboard/advance-tools/buy-sell-exchange/${listing.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </DropdownMenuItem>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isDeleting} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                         <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the listing: {listing.title}.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(listing.id!, listing.title)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                    {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DropdownMenuContent>
            </DropdownMenu>
        )}
      </CardFooter>
    </Card>
));
ListingCard.displayName = 'ListingCard';


export default function BuySellExchangeClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const canCreateListings = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageListings;

  const fetchListings = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/listings`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch listings.');
      setListings(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load listings: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) { fetchListings(); }
  }, [authLoading, fetchListings]);
  
  const handleDelete = async (listingId: string, listingTitle: string) => {
    // Permission check before calling API
    const listingToDelete = listings.find(l => l.id === listingId);
    if (!listingToDelete) return;
    
    const isDirectOwner = user?.uid === listingToDelete.userId;
    const isSupervisorWithPermission = !isViewingOwnAccount && dataOwnerId === listingToDelete.userId && !!currentTeamMemberPermissions?.canManageListings;

    if (!isDirectOwner && !isSupervisorWithPermission) {
        toast({ title: "Permission Denied", description: "You cannot delete this listing.", variant: "destructive" });
        return;
    }
    
    setIsDeleting(true); setCurrentDeletingId(listingId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/listings/${listingId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete listing.');
      toast({ title: "Success", description: `${listingTitle} deleted.` });
      setListings(prev => prev.filter(l => l.id !== listingId));
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete listing: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };

  const sortedAndFilteredListings = useMemo(() => {
    return listings
      .filter(l => filterType === 'all' || l.itemType === filterType)
      .filter(l => 
        l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.category && l.category.toLowerCase().includes(searchTerm.toLowerCase()))
      )
  }, [listings, searchTerm, filterType]);

  const totalPages = Math.ceil(sortedAndFilteredListings.length / itemsPerPage);
  const paginatedListings = sortedAndFilteredListings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  if (isLoading || authLoading) return <BuySellExchangeLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><Store className="mr-3 h-7 w-7 text-primary" /> Buy/Sell/Exchange</h1><p className="text-muted-foreground">A marketplace for the contractor community.</p></div>
        <Button asChild disabled={!canCreateListings} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/advance-tools/buy-sell-exchange/new"><PlusCircle className="mr-2 h-5 w-5" /> Create New Listing</Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Marketplace Listings</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search listings..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
            <Select onValueChange={(value) => { setFilterType(value); setCurrentPage(1); }} defaultValue="all">
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem><SelectItem value="exchange">Exchange</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedListings.length === 0 ? (
            <div className="text-center py-12"><Store className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-4 text-lg font-medium">{searchTerm ? "No listings match your search." : "No listings available yet."}</p></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedListings.map(listing => {
                  const isDirectOwner = user?.uid === listing.userId;
                  const isSupervisorWithPermission = !isViewingOwnAccount && dataOwnerId === listing.userId && !!currentTeamMemberPermissions?.canManageListings;
                  const canManageThisListing = isDirectOwner || isSupervisorWithPermission;
                  
                  return <ListingCard 
                            key={listing.id} 
                            listing={listing} 
                            onDelete={handleDelete} 
                            isDeleting={isDeleting} 
                            currentDeletingId={currentDeletingId} 
                            canManage={canManageThisListing} 
                            setGlobalIsLoading={setGlobalIsLoading} />
              })}
            </div>
          )}
        </CardContent>
         {sortedAndFilteredListings.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-2">
            <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={listings.length} filteredItemCount={sortedAndFilteredListings.length}/>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
