
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Users, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, Loader2, ShoppingCart } from "lucide-react";
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { Subcontractor, TeamPermissions } from '@/types';
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
import SubcontractorsLoading from '@/app/dashboard/subcontractors/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Badge } from '@/components/ui/badge';

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  inactive: "bg-gray-100 text-gray-800 border-gray-300",
  'on_hold': "bg-orange-100 text-orange-800 border-orange-300",
};

interface SubcontractorCardProps {
  subcontractor: Subcontractor;
  onDelete: (id: string, name: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
  canCreatePO: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const SubcontractorCard = React.memo(({ subcontractor, onDelete, isDeleting, currentDeletingId, canManage, canCreatePO, setGlobalIsLoading }: SubcontractorCardProps) => (
    <Card className="shadow-sm flex flex-col h-full">
        <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-md">{subcontractor.name}</CardTitle>
                <Badge variant="outline" className={cn("capitalize", statusColors[subcontractor.status] || '')}>
                    {subcontractor.status.replace(/_/g, ' ')}
                </Badge>
            </div>
            <CardDescription className="text-xs">{subcontractor.specialization}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-0.5 pt-1 pb-2 flex-grow">
            <p><span className="font-medium">Contact:</span> {subcontractor.contactPerson || 'N/A'}</p>
            <p><span className="font-medium">Phone:</span> {subcontractor.phone || 'N/A'}</p>
        </CardContent>
        <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
             <Button asChild variant="outline" size="sm" className="text-xs" disabled={!canCreatePO} onClick={() => setGlobalIsLoading(true)}>
              <Link href={`/dashboard/advance-tools/purchase-orders/new?supplierType=subcontractor&supplierId=${subcontractor.id}`}>
                <ShoppingCart className="mr-1 h-3 w-3" /> Create PO
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="text-xs" asChild disabled={!canManage} onClick={() => setGlobalIsLoading(true)}>
              <Link href={`/dashboard/subcontractors/${subcontractor.id}/edit`}>
                <Edit className="mr-1 h-3 w-3" /> Edit
              </Link>
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManage || (isDeleting && currentDeletingId === subcontractor.id)} title={!canManage ? "Permission Denied" : "Delete Subcontractor"}>
                        {(isDeleting && currentDeletingId === subcontractor.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                </AlertDialogTrigger>
                 <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the record for {subcontractor.name}.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(subcontractor.id!, subcontractor.name)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                        {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
    </Card>
));
SubcontractorCard.displayName = 'SubcontractorCard';


export default function SubcontractorsClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Subcontractor; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const canManageSubcontractors = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageSubcontractors, [isViewingOwnAccount, currentTeamMemberPermissions]);
  const canCreatePurchaseOrders = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreatePurchaseOrders, [isViewingOwnAccount, currentTeamMemberPermissions]);

  const fetchSubcontractors = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageSubcontractors) {
      if (!authLoading && !canManageSubcontractors) toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false); return;
    }
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/subcontractors?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch subcontractors.');
      setSubcontractors(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load subcontractors: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, canManageSubcontractors, authLoading, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchSubcontractors();
    }
  }, [authLoading, fetchSubcontractors]);

  const handleDelete = async (subcontractorId: string, name: string) => {
    if (!canManageSubcontractors) return;
    setIsDeleting(true); setCurrentDeletingId(subcontractorId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/subcontractors/${subcontractorId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete subcontractor.');
      toast({ title: "Success", description: `${name} deleted.` });
      setSubcontractors(prev => prev.filter(s => s.id !== subcontractorId));
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete subcontractor: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };
  
  const sortedAndFilteredItems = useMemo(() => {
    let filtered = subcontractors.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue as string) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [subcontractors, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredItems.length / itemsPerPage);
  const paginatedItems = sortedAndFilteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) return <SubcontractorsLoading />;
  if (!canManageSubcontractors) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="w-16 h-16 text-destructive mb-4" /><h2 className="text-xl font-semibold">Permission Denied</h2><p className="text-muted-foreground">You do not have permission to manage subcontractors.</p><Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard">Back to Dashboard</Link></Button></div> );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><Users className="mr-3 h-7 w-7 text-primary"/>Subcontractors</h1><p className="text-muted-foreground">Manage your list of trusted subcontractors and their details.</p></div>
        <Button asChild disabled={!canManageSubcontractors} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/subcontractors/new"><PlusCircle className="mr-2 h-5 w-5"/> Add New Subcontractor</Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Subcontractors</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search by name, specialization, contact..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="md:hidden grid gap-4 sm:grid-cols-2">
            {paginatedItems.length > 0 ? paginatedItems.map(s => <SubcontractorCard key={s.id} subcontractor={s} onDelete={handleDelete} isDeleting={isDeleting} currentDeletingId={currentDeletingId} canManage={canManageSubcontractors} canCreatePO={canCreatePurchaseOrders} setGlobalIsLoading={setGlobalIsLoading} />) : <p className="text-muted-foreground text-center py-8 col-span-full">No subcontractors found.</p>}
          </div>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Specialization</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginatedItems.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center h-24">No subcontractors found.</TableCell></TableRow>) : (
                    paginatedItems.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.name}</TableCell>
                        <TableCell>{sub.specialization}</TableCell>
                        <TableCell>{sub.contactPerson || 'N/A'}</TableCell>
                        <TableCell>{sub.phone || 'N/A'}</TableCell>
                        <TableCell><Badge variant="outline" className={`capitalize ${statusColors[sub.status] || ''}`}>{sub.status.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="text-right">
                           <Button asChild variant="outline" size="sm" className="mr-1" disabled={!canCreatePurchaseOrders} onClick={() => setGlobalIsLoading(true)}>
                              <Link href={`/dashboard/advance-tools/purchase-orders/new?supplierType=subcontractor&supplierId=${sub.id}`}>
                                <ShoppingCart className="mr-2 h-4 w-4"/> Create PO
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGlobalIsLoading(true)} disabled={!canManageSubcontractors}><Link href={`/dashboard/subcontractors/${sub.id}/edit`}><Edit className="h-4 w-4"/></Link></Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManageSubcontractors || (isDeleting && currentDeletingId === sub.id)}>
                                        {isDeleting && currentDeletingId === sub.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {sub.name}.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(sub.id!, sub.name)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
        {sortedAndFilteredItems.length > 0 && (<CardFooter className="border-t pt-2"><DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={subcontractors.length} filteredItemCount={sortedAndFilteredItems.length}/></CardFooter>)}
      </Card>
    </div>
  );
}
