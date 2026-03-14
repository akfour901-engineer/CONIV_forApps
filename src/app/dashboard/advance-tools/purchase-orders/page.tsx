'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, ShoppingCart, Search, ArrowDownUp, ArrowLeft, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { PurchaseOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/loading-context';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { PurchaseOrderCard } from '@/components/purchase-orders/purchase-order-card';

function PurchaseOrdersPageContent() {
  const { user, loading: authLoading, dataOwnerId, currentTeamMemberPermissions, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof PurchaseOrder; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canManagePOs = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreatePurchaseOrders;

  const fetchPOs = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/purchase-orders?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch purchase orders.');
      setPurchaseOrders(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (!authLoading) fetchPOs();
  }, [authLoading, fetchPOs]);

  const handleDelete = async (poId: string, poNumber: string) => {
    setIsDeleting(true); setCurrentDeletingId(poId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/purchase-orders/${poId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Failed to delete PO.');
      toast({ title: "Success", description: `PO ${poNumber} deleted.` });
      setPurchaseOrders(prev => prev.filter(po => po.id !== poId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(po => 
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierOrganizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (po.workOrderNumber && po.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [purchaseOrders, searchTerm]);

  const sortedPOs = useMemo(() => {
    if (!sortConfig) return filteredPOs;
    return [...filteredPOs].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (!aVal || !bVal) return 0;
      return aVal.toString().localeCompare(bVal.toString()) * (sortConfig.direction === 'asc' ? 1 : -1);
    });
  }, [filteredPOs, sortConfig]);

  const totalPages = Math.ceil(sortedPOs.length / itemsPerPage);
  const paginatedPOs = sortedPOs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) return <div className="p-8 text-center">Loading purchase orders...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <ShoppingCart className="mr-3 h-7 w-7 text-primary" /> Purchase Orders
          </h1>
          <p className="text-muted-foreground">Create and manage your procurement records.</p>
        </div>
        <Button asChild disabled={!canManagePOs} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/advance-tools/purchase-orders/new">
            <PlusCircle className="mr-2 h-5 w-5" /> New PO
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>PO List</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by number, supplier, WO#..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </CardHeader>
        <CardContent>
          {paginatedPOs.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-lg font-medium">No Purchase Orders Found</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginatedPOs.map(po => (
                <PurchaseOrderCard 
                  key={po.id} 
                  po={po} 
                  onDelete={handleDelete} 
                  isDeleting={isDeleting}
                  currentDeletingId={currentDeletingId}
                  canDelete={canManagePOs}
                  setGlobalIsLoading={setGlobalIsLoading}
                />
              ))}
            </div>
          )}
        </CardContent>
        {sortedPOs.length > 0 && (
          <CardFooter className="border-t pt-4">
            <DataTablePagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              canPreviousPage={currentPage > 1}
              canNextPage={currentPage < totalPages}
              itemCount={purchaseOrders.length}
              filteredItemCount={sortedPOs.length}
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default function PurchaseOrdersPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading purchase orders...</div>}>
            <PurchaseOrdersPageContent />
        </Suspense>
    );
}