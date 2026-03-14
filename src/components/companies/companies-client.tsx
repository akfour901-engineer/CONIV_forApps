
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Building2, Trash2, Edit, Globe, Phone, Mail, Loader2, AlertTriangle, Workflow } from "lucide-react";
import Link from 'next/link';
import Image from "next/image";
import { useAuth } from '@/hooks/use-auth';
import type { Company } from '@/types';
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
import CompaniesLoading from '@/app/dashboard/companies/loading';
import { useLoading } from '@/contexts/loading-context';

const CompanyCard = React.memo(({ company, onDelete, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: { company: Company, onDelete: (companyId: string, companyName: string) => void, isDeleting: boolean, currentDeletingId: string | null, canManage: boolean, setGlobalIsLoading: (loading: boolean) => void }) => {
  return (
    <Card key={company.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <div className="relative w-16 h-16 shrink-0">
          <Image src={company.logoUrl || 'https://placehold.co/100x100.png'} alt={`${company.name} logo`} layout="fill" objectFit="contain" className="rounded-md border p-1" data-ai-hint="company logo" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">{company.name}</CardTitle>
          <CardDescription className="text-xs">{company.companyType || 'N/A'}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-2 text-sm text-muted-foreground flex-grow">
        {company.contactPerson && <p className="flex items-center"><Mail className="mr-2 h-4 w-4" />{company.contactPerson}</p>}
        {company.contactPhone && <p className="flex items-center"><Phone className="mr-2 h-4 w-4" />{company.contactPhone}</p>}
        {company.address && <p className="flex items-start"><Globe className="mr-2 h-4 w-4 mt-0.5" /><span className="line-clamp-2">{company.address}</span></p>}
      </CardContent>
      <CardFooter className="border-t pt-4 mt-auto flex flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" className="w-full" onClick={() => setGlobalIsLoading(true)}>
             <Link href={`/dashboard/companies/${company.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit/View
             </Link>
          </Button>
           <Button asChild variant="secondary" className="w-full" onClick={() => setGlobalIsLoading(true)}>
            <Link href={`/dashboard/companies/${company.id}/design-studio`}>
              <Workflow className="mr-2 h-4 w-4" /> Design Studio
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={!canManage || isDeleting}>
                    {isDeleting && currentDeletingId === company.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Delete
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your company profile for `{company.name}`.
                  This may fail if the company is linked to any estimates, work orders, or invoices.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(company.id!, company.name)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                    {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </CardFooter>
    </Card>
  );
});
CompanyCard.displayName = 'CompanyCard';

export default function CompaniesClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const canManageCompanies = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageCompanies, [isViewingOwnAccount, currentTeamMemberPermissions]);

  const fetchCompanies = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageCompanies) {
      setIsLoading(false);
      setCompanies([]); // Clear companies if no permission
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch companies.');
      }
      const companiesData: Company[] = await response.json();
      setCompanies(companiesData);
    } catch (error: any) {
      console.error("Error fetching companies (from API): ", error);
      toast({ title: "Error", description: `Could not load your companies: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, canManageCompanies, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchCompanies();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [dataOwnerId, authLoading, user, fetchCompanies]);

  const handleDeleteCompany = useCallback(async (companyId: string, companyName: string) => {
    setIsDeleting(true);
    setCurrentDeletingId(companyId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'COMPANY_HAS_DEPENDENCIES') {
          toast({ title: "Deletion Blocked", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
          throw new Error(errorData.error || 'Failed to delete company.');
        }
      } else {
        toast({ title: "Success", description: `Company "${companyName}" deleted.` });
        setCompanies(prevCompanies => prevCompanies.filter(c => c.id !== companyId));
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete company: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setCurrentDeletingId(null);
    }
  }, [user, toast]);

  if (isLoading || authLoading) {
    return <CompaniesLoading />;
  }

  if (!canManageCompanies) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage companies.</p>
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
            <Building2 className="mr-3 h-7 w-7 text-primary" /> Companies
          </h1>
          <p className="text-muted-foreground">Manage your business entities.</p>
        </div>
        <Button asChild disabled={!canManageCompanies} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/companies/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Company
          </Link>
        </Button>
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">No Companies Added Yet</p>
          <p className="text-sm text-muted-foreground">Get started by adding your first company profile.</p>
          <Button className="mt-6" asChild disabled={!canManageCompanies} onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/companies/new">
              <span className="flex items-center"><PlusCircle className="mr-2 h-5 w-5" /> Add Your First Company</span>
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map(company => (
            <CompanyCard 
                key={company.id} 
                company={company} 
                onDelete={handleDeleteCompany} 
                isDeleting={isDeleting}
                currentDeletingId={currentDeletingId}
                canManage={canManageCompanies}
                setGlobalIsLoading={setGlobalIsLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
