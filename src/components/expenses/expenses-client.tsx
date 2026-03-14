
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CreditCard, PlusCircle, ArrowLeft, Search, Edit, Trash2, Loader2, ExternalLink, DownloadCloud, AlertTriangle } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { Expense, TeamPermissions } from '@/types';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExpensesLoadingSkeleton from '@/app/dashboard/expenses/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Input } from '../ui/input';

const formatCurrency = (amount: number | undefined | null): string => {
  if(amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try { return new Date(dateString).toLocaleDateString('en-GB'); }
  catch (e) { return dateString; }
};

interface ExpenseCardProps {
  expense: Expense;
  onDeleteExpense: (expenseId: string, expenseDesc: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const ExpenseCard = React.memo(({ 
  expense, 
  onDeleteExpense, 
  isDeleting, 
  currentDeletingId, 
  canManage, 
  setGlobalIsLoading 
}: ExpenseCardProps) => {
  return (
    <Card key={expense.id} className="shadow-sm overflow-hidden"> {/* ← added overflow-hidden */}
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0"> {/* min-w-0 is good – keep it */}
            <CardTitle className="text-base leading-tight font-semibold">
              {expense.category}
            </CardTitle>
            <CardDescription 
              className="text-xs line-clamp-2"  // ← changed to line-clamp-2
              title={expense.description || "No description"}
            >
              {expense.description || "—"}
            </CardDescription>
          </div>
          <span className="text-sm font-bold text-primary whitespace-nowrap flex-shrink-0 pl-2">
            {formatCurrency(expense.amount)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="text-sm space-y-1 pt-1 pb-3">
        <p className="overflow-hidden text-ellipsis">
          <span className="font-medium">Date:</span> {formatDate(expense.date)}
        </p>

        {expense.companyName && (
          <p className="overflow-hidden text-ellipsis break-words">
            <span className="font-medium">Company:</span> {expense.companyName}
          </p>
        )}

        {expense.workOrderNumber && (
          <p className="overflow-hidden text-ellipsis break-all">  {/* ← break-all helps with very long WO# */}
            <span className="font-medium">WO#:</span> {expense.workOrderNumber}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          Added by {expense.createdByName || 'N/A'} on{' '}
          {expense.createdAt 
            ? new Date(expense.createdAt).toLocaleDateString('en-GB') 
            : 'N/A'}
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-end gap-2 pt-2 pb-3 border-t px-4">
        {expense.receiptUrl && (
          <a
            href={expense.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "text-xs flex-shrink-0"
            )}
            title="View/Download Receipt"
          >
            {expense.receiptUrl.startsWith('data:') 
              ? <DownloadCloud className="mr-1 h-3 w-3" /> 
              : <ExternalLink className="mr-1 h-3 w-3" />}
            Receipt
          </a>
        )}

        <Button
          variant="outline"
          size="sm"
          className="text-xs flex-shrink-0"
          asChild
          title="Edit Expense"
          disabled={!canManage}
          onClick={() => setGlobalIsLoading(true)}
        >
          <Link href={`/dashboard/expenses/${expense.id}/edit`} className="flex items-center">
            <Edit className="mr-1 h-3 w-3" /> Edit
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="text-xs flex-shrink-0"
              disabled={!canManage || (isDeleting && currentDeletingId === expense.id)}
              title={!canManage ? "Permission Denied" : "Delete Expense"}
            >
              {(isDeleting && currentDeletingId === expense.id) ? (
                <span className="flex items-center">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Deleting
                </span>
              ) : (
                <span className="flex items-center">
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </span>
              )}
            </Button>
          </AlertDialogTrigger>
          {/* ... rest of AlertDialog stays the same ... */}
        </AlertDialog>
      </CardFooter>
    </Card>
  );
});
ExpenseCard.displayName = 'ExpenseCard';

export default function ExpensesClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const canManageExpenses = useMemo(() => {
    return isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageExpenses;
  }, [isViewingOwnAccount, currentTeamMemberPermissions]);


  const fetchExpenses = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); setExpenses([]); return; }
    if (!canManageExpenses) {
        setIsLoading(false); setExpenses([]);
        toast({ title: "Permission Denied", description: "You do not have permission to view expenses.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/expenses?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        let errorMsg = `API request failed with status ${response.status}`;
        try { const errorData = await response.json(); errorMsg = errorData.details || errorData.error || errorMsg; } catch (e) { errorMsg = response.statusText || errorMsg; }
        throw new Error(errorMsg);
      }
      const data: Expense[] = await response.json();
      setExpenses(data);
    } catch (error: any) {
      console.error("Error fetching expenses (from API): ", error);
      if (error.code === 'failed-precondition') {
        toast({ title: "Index Required", description: "Firestore needs an index for expenses. Check browser console for link.", variant: "destructive", duration: 10000 });
      } else if (error.code === 'permission-denied') {
         toast({ title: "Permission Denied", description: "You do not have permission to fetch expenses. Check Firestore rules.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to fetch expenses.", variant: "destructive" });
      }
       setExpenses([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, toast, canManageExpenses]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchExpenses();
    } else if (!authLoading && !user) {
        setIsLoading(false);
    }
  }, [dataOwnerId, authLoading, user, fetchExpenses]);

  const handleDeleteExpense = useCallback(async (expenseId: string, expenseDesc: string) => {
    if (!user || !userProfile || !dataOwnerId ) {
        toast({ title: "Error", description: "User details not available for logging activity.", variant: "destructive"});
        return;
    }
    if (!canManageExpenses) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete expenses.", variant: "destructive"});
      return;
    }
    setIsDeleting(true);
    setCurrentDeletingId(expenseId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        let errorMsg = `API request failed with status ${response.status}`;
        try { const errorData = await response.json(); errorMsg = errorData.details || errorData.error || errorMsg; } catch (e) { errorMsg = response.statusText || errorMsg; }
        throw new Error(errorMsg);
      }
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
      toast({ title: "Success", description: "Expense deleted successfully." });
      // API handles logging
    } catch (error: any) {
      console.error("Error deleting expense via API: ", error);
      toast({ title: "Error", description: `Failed to delete expense. ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setCurrentDeletingId(null);
    }
  }, [canManageExpenses, user, dataOwnerId, userProfile, toast]);

  const filteredExpenses = expenses.filter(exp => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      exp.category.toLowerCase().includes(searchTermLower) ||
      exp.description.toLowerCase().includes(searchTermLower) ||
      (exp.companyName && exp.companyName.toLowerCase().includes(searchTermLower)) ||
      (exp.workOrderNumber && exp.workOrderNumber.toLowerCase().includes(searchTermLower))
    );
  });

  if (isLoading || authLoading) {
    return <ExpensesLoadingSkeleton />;
  }

  if (!isViewingOwnAccount && !canManageExpenses) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view expenses.</p>
        <Button asChild onClick={() => setGlobalIsLoading(true)}>
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
            <CreditCard className="mr-3 h-7 w-7 text-primary" /> Expense Tracking
          </h1>
          <p className="text-muted-foreground">
            Log, categorize, and manage all your business expenses.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto" disabled={!canManageExpenses} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/expenses/new">
            <span><PlusCircle className="mr-2 h-5 w-5" /> Add New Expense</span>
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Expenses</CardTitle>
          <CardDescription>A list of all recorded expenses.</CardDescription>
           <div className="pt-2">
            <Input
              placeholder="Search by Category, Desc, Company, WO#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </CardHeader>
        <CardContent>
           <div className="md:hidden grid gap-4 sm:grid-cols-2">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-12 col-span-full"> <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" /> <p className="mt-4 text-lg font-medium">{searchTerm ? "No Expenses Match Your Search" : "No Expenses Recorded Yet"}</p> {!searchTerm && ( <Button className="mt-6" asChild disabled={!canManageExpenses} onClick={() => setGlobalIsLoading(true)}> <Link href="/dashboard/expenses/new"> <span><PlusCircle className="mr-2 h-5 w-5" /> Add Your First Expense</span> </Link> </Button> )} </div>
              ) : (
                filteredExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    onDeleteExpense={handleDeleteExpense}
                    isDeleting={isDeleting}
                    currentDeletingId={currentDeletingId}
                    canManage={canManageExpenses}
                    setGlobalIsLoading={setGlobalIsLoading}
                  />
                ))
              )}
            </div>
            <div className="hidden md:block">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-12"> <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" /> <p className="mt-4 text-lg font-medium">{searchTerm ? "No Expenses Match Your Search" : "No Expenses Recorded Yet"}</p> {!searchTerm && ( <Button className="mt-6" asChild disabled={!canManageExpenses} onClick={() => setGlobalIsLoading(true)}> <Link href="/dashboard/expenses/new"> <span><PlusCircle className="mr-2 h-5 w-5" /> Add Your First Expense</span> </Link> </Button> )} </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="w-[30%]">Description</TableHead>
                        <TableHead className="hidden lg:table-cell">Company</TableHead>
                        <TableHead className="hidden lg:table-cell">WO #</TableHead>
                        <TableHead className="text-right w-[120px]">Amount</TableHead>
                        <TableHead className="text-right min-w-[200px]">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{formatDate(expense.date)}</TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell className="truncate" title={expense.description}>{expense.description}</TableCell>
                          <TableCell className="hidden lg:table-cell">{expense.companyName || 'N/A'}</TableCell>
                          <TableCell className="hidden lg:table-cell">{expense.workOrderNumber || 'N/A'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center space-x-0.5">
                              {expense.receiptUrl && (
                                <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))} title="View/Download Receipt">
                                  {expense.receiptUrl.startsWith('data:') ? <DownloadCloud className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                                  
                                </a>
                              )}
                              <Button asChild variant="ghost" size="sm" title="Edit Expense" disabled={!canManageExpenses} onClick={() => setGlobalIsLoading(true)}>
                                <Link href={`/dashboard/expenses/${expense.id}/edit`} className="flex items-center gap-1">
                                    <Edit className="mr-1 h-4 w-4" />
                                </Link>
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/90" disabled={!canManageExpenses || (isDeleting && currentDeletingId === expense.id)} title={!canManageExpenses ? "Permission Denied" : "Delete Expense"}>
                                    {isDeleting && currentDeletingId === expense.id ? (
                                      <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /></span>
                                    ) : (
                                      <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /></span>
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the expense: {expense.description}.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting && currentDeletingId === expense.id}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteExpense(expense.id!, expense.description)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting && currentDeletingId === expense.id}>
                                      <span className="flex items-center">
                                        {(isDeleting && currentDeletingId === expense.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        {(isDeleting && currentDeletingId === expense.id) ? "Deleting..." : "Delete"}
                                      </span>
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
        </CardContent>
         <CardFooter className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Showing {filteredExpenses.length} of {expenses.length} expenses.
            </p>
          </CardFooter>
      </Card>
    </div>
  );
}
