
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Award, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, Loader2 } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { License, TeamPermissions } from '@/types';
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
import LicensesLoadingSkeleton from '@/app/dashboard/licenses/loading';
import { useLoading } from '@/contexts/loading-context';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { format, isBefore, addDays, parseISO } from 'date-fns';

const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'dd MMM yyyy');
    } catch (e) {
        return 'Invalid Date';
    }
};

const getStatus = (expiryDate: string | undefined | null): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (!expiryDate) return { text: 'No Expiry', variant: 'outline' };
    const date = parseISO(expiryDate);
    const today = new Date();
    if (isBefore(date, today)) return { text: 'Expired', variant: 'destructive' };
    if (isBefore(date, addDays(today, 90))) return { text: 'Expiring Soon', variant: 'secondary' };
    return { text: 'Active', variant: 'default' };
};

interface LicenseCardProps {
  license: License;
  onDelete: (id: string, name: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
}

const LicenseCard = React.memo(({ license, onDelete, isDeleting, currentDeletingId, canManage }: LicenseCardProps) => {
    const status = getStatus(license.expiryDate);
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-md line-clamp-2">{license.licenseName}</CardTitle>
                    <Badge variant={status.variant} className="capitalize">{status.text}</Badge>
                </div>
                <CardDescription className="text-xs">{license.licenseType}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
                <p><span className="font-medium">Number:</span> {license.licenseNumber}</p>
                <p><span className="font-medium">Authority:</span> {license.issuingAuthority}</p>
                <p><span className="font-medium">Expiry:</span> {formatDate(license.expiryDate)}</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                 <Button asChild variant="outline" size="sm" className="text-xs" disabled={!canManage}>
                    <Link href={`/dashboard/licenses/${license.id}/edit`}><Edit className="mr-1 h-3 w-3"/>Edit</Link>
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="text-xs" disabled={!canManage || (isDeleting && currentDeletingId === license.id)}>
                            {isDeleting && currentDeletingId === license.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the license: {license.licenseName}.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(license.id!, license.licenseName)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    )
});
LicenseCard.displayName = 'LicenseCard';

export default function LicensesClient() {
  const { user, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof License; direction: 'asc' | 'desc' } | null>({ key: 'expiryDate', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const canManageLicenses = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOwnerLicenses;

  const fetchLicenses = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageLicenses) {
      if(!authLoading && !canManageLicenses) toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false); return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/licenses?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch licenses.');
      setLicenses(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load licenses: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, canManageLicenses, toast, authLoading]);

  useEffect(() => {
    if (!authLoading) {
        fetchLicenses();
    }
  }, [authLoading, fetchLicenses]);
  
  const handleDelete = async (licenseId: string, licenseName: string) => {
    if (!canManageLicenses) return;
    setIsDeleting(true); setCurrentDeletingId(licenseId);
    try {
        const idToken = await user!.getIdToken();
        const response = await fetch(`/api/licenses/${licenseId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` }});
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete license.');
        toast({ title: "Success", description: `License "${licenseName}" deleted.` });
        fetchLicenses(); // Refresh list
    } catch (error: any) {
        toast({ title: "Error", description: `Could not delete license: ${error.message}`, variant: "destructive" });
    } finally {
        setIsDeleting(false); setCurrentDeletingId(null);
    }
  };
  
  const sortedAndFilteredLicenses = useMemo(() => {
    let filtered = licenses.filter(lic =>
      lic.licenseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lic.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lic.licenseType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lic.issuingAuthority.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (sortConfig.key === 'expiryDate' || sortConfig.key === 'issueDate') {
            return (new Date(aVal as string).getTime() - new Date(bVal as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [licenses, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredLicenses.length / itemsPerPage);
  const paginatedLicenses = sortedAndFilteredLicenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) return <LicensesLoadingSkeleton />;
  if (!canManageLicenses) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage licenses.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Award className="mr-3 h-7 w-7 text-primary" /> Licenses
          </h1>
          <p className="text-muted-foreground">Track expiry dates and manage all your business licenses.</p>
        </div>
        <Button asChild disabled={!canManageLicenses} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/licenses/new"><PlusCircle className="mr-2 h-5 w-5" /> Add New License</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Licenses</CardTitle>
           <div className="pt-2">
            <Input
              placeholder="Search by name, number, type..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </CardHeader>
        <CardContent>
             <div className="md:hidden grid gap-4 sm:grid-cols-2">
                {paginatedLicenses.length > 0 ? paginatedLicenses.map(lic => <LicenseCard key={lic.id} license={lic} onDelete={handleDelete} isDeleting={isDeleting} currentDeletingId={currentDeletingId} canManage={canManageLicenses}/>) : <p className="text-muted-foreground text-center py-8 col-span-full">No licenses found.</p>}
            </div>
            <div className="hidden md:block">
              {paginatedLicenses.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>License Name</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLicenses.map((lic) => {
                      const status = getStatus(lic.expiryDate);
                      return (
                        <TableRow key={lic.id}>
                          <TableCell className="font-medium">{lic.licenseName}</TableCell>
                          <TableCell>{lic.licenseNumber}</TableCell>
                          <TableCell>{formatDate(lic.expiryDate)}</TableCell>
                          <TableCell><Badge variant={status.variant} className="capitalize">{status.text}</Badge></TableCell>
                          <TableCell className="text-right">
                             <Button asChild variant="ghost" size="sm" onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/licenses/${lic.id}/edit`}><Edit className="mr-2 h-4 w-4"/>Edit</Link></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={isDeleting && currentDeletingId === lic.id}><Trash2 className="mr-2 h-4 w-4"/>Delete</Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete the license: {lic.licenseName}.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(lic.id!, lic.licenseName)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              ) : <p className="text-center py-12 text-muted-foreground">No licenses found.</p>}
            </div>
        </CardContent>
         <CardFooter className="border-t pt-2">
           <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={licenses.length} filteredItemCount={sortedAndFilteredLicenses.length}/>
        </CardFooter>
      </Card>
    </div>
  );
}

