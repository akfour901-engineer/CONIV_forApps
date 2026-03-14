
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Building2, Trash2, Edit, Globe, Phone, Mail, Loader2, AlertTriangle, Workflow, Link as LinkIconOriginal } from "lucide-react";
import Link from 'next/link';
import Image from "next/image";
import { useAuth } from '@/hooks/use-auth';
import type { Organization } from '@/types';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from 'date-fns';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import OrganizationsLoading from './loading';
import { useLoading } from '@/contexts/loading-context';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowDownUp, Lock, Users, MapPin } from 'lucide-react';

interface OrganizationCardProps {
  org: Organization;
  onDeleteOrganization: (orgId: string, orgName: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canEditThis: boolean;
  canDeleteThis: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const OrganizationCard = React.memo(({ org, onDeleteOrganization, isDeleting, currentDeletingId, canEditThis, canDeleteThis, setGlobalIsLoading }: OrganizationCardProps) => {
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return null;
    try { return format(parseISO(dateString), 'dd MMM yy'); } catch (e) { return null; }
  };
  const nextFollowUp = formatDate(org.nextFollowUpDate);

  return (
    <Card key={org.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{org.name}</CardTitle>
          <Badge variant={org.visibility === 'public' ? 'secondary' : 'outline'} className="capitalize text-xs whitespace-nowrap">
            {org.visibility === 'public' ? <Globe className="mr-1 h-3 w-3" /> : <Lock className="mr-1 h-3 w-3" />}
            {org.visibility}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {org.type || 'N/A'}
          {org.organizationStatus && <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 capitalize">{org.organizationStatus.replace(/-/g," ")}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-1.5 text-sm text-muted-foreground">
        {org.address && <p className="flex items-start gap-1.5"><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary/70" /> <span className="line-clamp-2">{org.address}{org.city ? `, ${org.city}` : ''}</span></p>}
        {org.contactPerson && <p><span className="font-medium text-foreground">Contact:</span> {org.contactPerson}</p>}
        {nextFollowUp && <p className="font-medium text-amber-600">Next Follow-up: {nextFollowUp}</p>}
        <p className="text-xs pt-1">Added: {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'N/A'} by {org.createdByName || 'N/A'}</p>
      </CardContent>
      <CardFooter className="border-t pt-4 mt-auto flex items-center gap-2 flex-wrap">
         <Button asChild variant="outline" className="flex-1" size="sm" disabled={!canEditThis} title={!canEditThis ? "Permission Denied" : "Manage Organization"} onClick={() => setGlobalIsLoading(true)}>
            <Link href={`/dashboard/organizations/${org.id}`}>
                <Edit className="mr-2 h-4 w-4" /> Manage
            </Link>
         </Button>
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10" disabled={!canDeleteThis || (isDeleting && currentDeletingId === org.id)} title={!canDeleteThis ? "Permission Denied" : "Delete Organization"}>
                    {(isDeleting && currentDeletingId === org.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the organization `{org.name}`. It may fail if linked to estimates, work orders, or invoices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting && currentDeletingId === org.id}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeleteOrganization(org.id!, org.name)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting && currentDeletingId === org.id}>
                    <span className="flex items-center">
                      {(isDeleting && currentDeletingId === org.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete
                    </span>
                  </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
});
OrganizationCard.displayName = 'OrganizationCard';

export default function OrganizationsPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Organization; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const canCreateOrganizations = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOrganizations;
  const canViewOrganizations = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOrganizations;

  const fetchOrganizations = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); setOrganizations([]); return; }
    if (!canViewOrganizations) {
      setIsLoading(false); setOrganizations([]);
      toast({ title: "Permission Denied", description: "You do not have permission to view organizations.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/organizations?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        let errorMsg = `API request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.details || errorData.error || errorMsg;
        } catch (e) {
          errorMsg = response.statusText || errorMsg;
        }
        throw new Error(errorMsg);
      }
      const orgsData: Organization[] = await response.json();
      setOrganizations(orgsData);
    } catch (error: any) {
      console.error("Error fetching organizations (from API): ", error);
      if (error.code === 'failed-precondition') {
        toast({ title: "Index Required", description: "Firestore needs an index for organizations. Check browser console for link.", variant: "destructive", duration: 10000 });
      } else {
        toast({ title: "Error Fetching Organizations", description: error.message, variant: "destructive" });
      }
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, toast, canViewOrganizations]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchOrganizations();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [dataOwnerId, authLoading, user, fetchOrganizations]);

  const handleDeleteOrganization = useCallback(async (orgId: string, orgName: string) => {
    if (!user || !userProfile || !dataOwnerId) return;

    const canDeleteThis = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOrganizations;
    if (!canDeleteThis) {
      toast({ title: "Permission Denied", description: "You do not have permission to delete this organization.", variant: "destructive"});
      return;
    }

    setGlobalIsLoading(true);
    setIsDeleting(true); setCurrentDeletingId(orgId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });

      if (!response.ok) {
        let errorMsg = `API request failed with status ${response.status}`;
        try { const errorData = await response.json(); errorMsg = errorData.details || errorData.error || errorMsg; } catch (e) { /* no json body */ }
        throw new Error(errorMsg);
      } else {
        setOrganizations(organizations.filter(org => org.id !== orgId));
        toast({ title: "Success", description: `Organization "${orgName}" deleted.` });
      }
    } catch (error: any) {
      console.error("Error deleting organization via API: ", error);
      toast({ title: "Error Deleting Organization", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null); setGlobalIsLoading(false);
    }
  }, [user, toast, organizations, userProfile, dataOwnerId, isViewingOwnAccount, currentTeamMemberPermissions, setGlobalIsLoading]);
  
  const sortedAndFilteredOrgs = useMemo(() => {
    let filtered = organizations.filter(org => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        (org.name ?? "").toLowerCase().includes(searchTermLower) ||
        (org.type && org.type.toLowerCase().includes(searchTermLower)) ||
        (org.contactPerson && org.contactPerson.toLowerCase().includes(searchTermLower)) ||
        (org.city && org.city.toLowerCase().includes(searchTermLower)) ||
        (org.state && org.state.toLowerCase().includes(searchTermLower)) ||
        (org.organizationStatus && org.organizationStatus.toLowerCase().includes(searchTermLower))
      );
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (sortConfig.key === 'createdAt' || sortConfig.key === 'nextFollowUpDate') {
          return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return (aValue ?? "").localeCompare(bValue ?? "") * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [organizations, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredOrgs.length / itemsPerPage);
  const paginatedOrgs = sortedAndFilteredOrgs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof Organization, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };

  if (isLoading || authLoading) {
    return <OrganizationsLoading />;
  }
  
  if (!canViewOrganizations) {
     return ( 
       <div className="flex flex-col items-center justify-center h-full p-8 text-center"> 
         <AlertTriangle className="w-16 h-16 text-destructive mb-4" /> 
         <h2 className="text-xl font-semibold">Permission Denied</h2> 
         <p className="text-muted-foreground">You do not have permission to view organizations.</p> 
         <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}> 
           <Link href="/dashboard">Back to Dashboard</Link> 
         </Button> 
       </div> 
     );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
         <div> 
           <h1 className="text-2xl font-semibold flex items-center"> 
             <Users className="mr-3 h-7 w-7 text-primary" /> Organizations & Clients 
           </h1> 
           <p className="text-muted-foreground">Manage client organizations and contacts. Public ones are visible to all users.</p> 
         </div>
        <Button asChild className="w-full sm:w-auto" disabled={!canCreateOrganizations} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/organizations/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Organization
          </Link>
        </Button>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader> 
          <CardTitle>Organization List</CardTitle> 
          <CardDescription>Search, sort, and manage organizations. Your private organizations and all public ones are listed.</CardDescription> 
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input 
                placeholder="Search by Name, Type, Status, Contact, City, State..." 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="pl-10" 
              />
            </div>
            <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'createdAt_desc'}>
              <SelectTrigger className="w-full md:w-[180px]">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4" />
                  <SelectValue placeholder="Sort by..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt_desc">Date: Newest</SelectItem>
                <SelectItem value="createdAt_asc">Date: Oldest</SelectItem>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="md:hidden grid gap-4">
            {paginatedOrgs.length === 0 ? (
              <div className="text-center py-12 col-span-full">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">{searchTerm ? "No Organizations Match Your Search" : "No Organizations Yet"}</p>
                {!searchTerm && (
                  <Button className="mt-6" asChild disabled={!canCreateOrganizations} onClick={() => setGlobalIsLoading(true)}>
                    <Link href="/dashboard/organizations/new">
                      <PlusCircle className="mr-2 h-5 w-5" /> Add Organization
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              paginatedOrgs.map((org) => {
                  const canManageThis = isViewingOwnAccount || (!!currentTeamMemberPermissions?.canManageOrganizations && org.userId === dataOwnerId);
                  return (
                    <OrganizationCard
                      key={org.id}
                      org={org}
                      onDeleteOrganization={handleDeleteOrganization}
                      isDeleting={isDeleting}
                      currentDeletingId={currentDeletingId}
                      canEditThis={canManageThis}
                      canDeleteThis={canManageThis}
                      setGlobalIsLoading={setGlobalIsLoading}
                    />
                  );
              })
            )}
          </div>
          <div className="hidden md:block">
            {paginatedOrgs.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">{searchTerm ? "No Organizations Match Your Search" : "No Organizations Yet"}</p>
                {!searchTerm && (
                  <Button className="mt-6" asChild disabled={!canCreateOrganizations} onClick={() => setGlobalIsLoading(true)}>
                    <Link href="/dashboard/organizations/new">
                      <PlusCircle className="mr-2 h-5 w-5" /> Add Organization
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden lg:table-cell">Type</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">City/State</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrgs.map((org) => {
                      const canManageThis = isViewingOwnAccount || (!!currentTeamMemberPermissions?.canManageOrganizations && org.userId === dataOwnerId);
                      return (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell className="hidden lg:table-cell">{org.type || 'N/A'}</TableCell>
                        <TableCell className="hidden md:table-cell capitalize">
                          {org.organizationStatus ? org.organizationStatus.replace(/-/g, " ") : 'N/A'}
                          {org.nextFollowUpDate && <p className="text-xs text-amber-600">Follow-up: {format(parseISO(org.nextFollowUpDate), 'dd MMM yy')}</p>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{org.city || 'N/A'}{org.state ? `, ${org.state}` : ''}</TableCell>
                        <TableCell>
                          <Badge variant={org.visibility === 'public' ? 'secondary' : 'outline'} className="capitalize text-xs">
                            {org.visibility === 'public' ? <Globe className="mr-1 h-3 w-3" /> : <Lock className="mr-1 h-3 w-3" />}
                            {org.visibility}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center flex-wrap gap-1">
                            <Button asChild variant="ghost" size="sm" disabled={!canManageThis} title={!canManageThis ? "Permission Denied" : "Manage Organization"} onClick={() => setGlobalIsLoading(true)}>
                              <Link href={`/dashboard/organizations/${org.id}`} className="flex items-center gap-1"> 
                                <Edit className="mr-1 h-4 w-4" /> Manage 
                              </Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10" disabled={!canManageThis || (isDeleting && currentDeletingId === org.id)} title={!canManageThis ? "Permission Denied" : "Delete Organization"}>
                                  {(isDeleting && currentDeletingId === org.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the organization `{org.name}`. It may fail if linked to estimates, work orders, or invoices.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isDeleting && currentDeletingId === org.id}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteOrganization(org.id!, org.name)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting && currentDeletingId === org.id}>
                                    <span className="flex items-center">
                                      {(isDeleting && currentDeletingId === org.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                      Delete
                                    </span>
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
        {sortedAndFilteredOrgs.length > 0 && (
         <CardFooter className="border-t pt-2">
           <DataTablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            itemCount={organizations.length}
            filteredItemCount={sortedAndFilteredOrgs.length}
           />
        </CardFooter>
        )}
      </Card>
    </div>
  );
}
