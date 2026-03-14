
'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Landmark, Eye, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, CheckCircle } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import type { BankAccount } from '@/types';
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
import BankAccountsLoading from './loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BankAccountCardProps {
  account: BankAccount;
  onDelete: (accountId: string, accountName: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const BankAccountCard = React.memo(({ account, onDelete, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: BankAccountCardProps) => (
  <Card className="shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
      <div className="flex justify-between items-start gap-2">
        <CardTitle className="text-lg">{account.bankName}</CardTitle>
        {account.isDefault && <Badge variant="default"><CheckCircle className="mr-1 h-3 w-3"/>Default</Badge>}
      </div>
      <CardDescription className="text-sm">A/C No: ...{account.accountNumber.slice(-4)}</CardDescription>
    </CardHeader>
    <CardContent className="text-sm space-y-1">
      <p><span className="font-medium">Holder:</span> {account.accountHolderName}</p>
      <p><span className="font-medium">IFSC:</span> {account.ifscCode}</p>
    </CardContent>
    <CardFooter className="flex justify-end gap-1 pt-3 border-t">
      <Button variant="ghost" size="sm" asChild onClick={() => setGlobalIsLoading(true)}>
          <Link href={`/dashboard/bank-accounts/${account.id}`}>
            <Eye className="mr-1 h-3 w-3" /> View/Edit
          </Link>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!canManage || (isDeleting && currentDeletingId === account.id)}>
                {isDeleting && currentDeletingId === account.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the bank account for {account.accountHolderName}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(account.id!, account.accountHolderName)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardFooter>
  </Card>
));
BankAccountCard.displayName = 'BankAccountCard';


function BankAccountsClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const router = useRouter();

  const canManageBankAccounts = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageBankAccounts;

  const fetchAccounts = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    if (!canManageBankAccounts) { 
        setIsLoading(false); 
        toast({ title: "Permission Denied", description: "You cannot view bank accounts.", variant: "destructive" });
        return; 
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/bank-accounts?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch bank accounts.');
      setAccounts(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load accounts: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, canManageBankAccounts, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchAccounts();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [dataOwnerId, authLoading, user, fetchAccounts]);

  const handleDelete = async (accountId: string, accountName: string) => {
    if (!canManageBankAccounts) return;
    setIsDeleting(true); setCurrentDeletingId(accountId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/bank-accounts/${accountId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete account.');
      toast({ title: "Success", description: `Account for ${accountName} deleted.` });
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete account: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };

  if (isLoading || authLoading) {
    return <BankAccountsLoading />;
  }

  if (!canManageBankAccounts) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage bank accounts.</p>
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
            <Landmark className="mr-3 h-7 w-7 text-primary" /> Bank Accounts
          </h1>
          <p className="text-muted-foreground">Manage your company and personal bank accounts.</p>
        </div>
        <Button asChild disabled={!canManageBankAccounts} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/bank-accounts/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Account
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Bank Accounts</CardTitle>
          <CardDescription>A list of all your registered bank accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <Landmark className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">No Bank Accounts Added Yet</p>
              <Button className="mt-6" asChild disabled={!canManageBankAccounts} onClick={() => setGlobalIsLoading(true)}>
                <Link href="/dashboard/bank-accounts/new">
                  <span className="flex items-center"><PlusCircle className="mr-2 h-5 w-5" /> Add Your First Account</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map(account => (
                <BankAccountCard
                  key={account.id}
                  account={account}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                  currentDeletingId={currentDeletingId}
                  canManage={canManageBankAccounts}
                  setGlobalIsLoading={setGlobalIsLoading}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BankAccountsPage() {
    return (
        <Suspense fallback={<BankAccountsLoading />}>
            <BankAccountsClientPage />
        </Suspense>
    );
}
