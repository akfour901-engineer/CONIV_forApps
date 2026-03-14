
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { BankAccount, Company } from '@/types';
import { Edit, Save, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import BankAccountDetailLoadingSkeleton from './loading';

const bankAccountFormSchema = z.object({
  accountHolderName: z.string().min(2, "Account holder name is required.").max(100),
  accountNumber: z.string().min(5, "Account number is required.").max(20),
  bankName: z.string().min(2, "Bank name is required.").max(100),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format."),
  accountType: z.enum(['savings', 'current', 'other'], { required_error: "Account type is required." }),
  isDefault: z.boolean().default(false),
  companyId: z.string().optional().nullable(),
});

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

interface EditBankAccountClientProps {
    accountId: string;
}

function EditBankAccountClient({ accountId }: EditBankAccountClientProps) {
  const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  const canManageBankAccounts = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageBankAccounts;

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
  });

  useEffect(() => {
    if (!authLoading && user && dataOwnerId) {
        setIsLoading(true);
        const fetchAccountAndCompanies = async () => {
            try {
                const idToken = await user.getIdToken();
                
                const companiesResponse = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, {
                    headers: { 'Authorization': `Bearer ${idToken}` },
                });
                if (companiesResponse.ok) {
                    const companiesData: Company[] = await companiesResponse.json();
                    setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name })));
                } else {
                  console.warn("Could not fetch companies for bank account form.");
                }
                
                const response = await fetch(`/api/bank-accounts/${accountId}`, {
                    headers: { 'Authorization': `Bearer ${idToken}` },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to fetch bank account details. Status: ${response.status}`);
                }
                const data: BankAccount = await response.json();
                setAccount(data);
                form.reset(data);

            } catch (error: any) {
                toast({ title: "Error", description: `Could not load account details: ${error.message}`, variant: "destructive" });
                router.push('/dashboard/bank-accounts');
            } finally {
                setIsLoading(false);
                setIsLoadingCompanies(false);
            }
        };

        fetchAccountAndCompanies();
    } else if (!authLoading && !user) {
        router.push('/auth/signin');
    }
  }, [accountId, user, dataOwnerId, authLoading, router, toast, form]);


  const onSubmit = async (values: BankAccountFormValues) => {
    if (!user || !dataOwnerId || !canManageBankAccounts) {
      toast({ title: "Error", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/bank-accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to update bank account.');
      }
      toast({ title: "Success", description: "Bank account updated successfully." });
      router.push('/dashboard/bank-accounts');
    } catch (error: any) {
      toast({ title: "Error Updating Account", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading || authLoading) {
    return <BankAccountDetailLoadingSkeleton />;
  }

  if (!account) {
    return <div className="text-center p-4">Account not found.</div>;
  }
  
  if (!canManageBankAccounts) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view or edit this bank account.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/bank-accounts">Back to Bank Accounts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Edit className="mr-3 h-7 w-7 text-primary" /> Edit Bank Account
          </h1>
          <p className="text-muted-foreground">Modify details for account ending in ...{account.accountNumber.slice(-4)}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/bank-accounts">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Bank Accounts
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Bank Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField name="accountHolderName" control={form.control} render={({ field }) => (<FormItem><FormLabel>Account Holder Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="accountNumber" control={form.control} render={({ field }) => (<FormItem><FormLabel>Account Number*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="bankName" control={form.control} render={({ field }) => (<FormItem><FormLabel>Bank Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="ifscCode" control={form.control} render={({ field }) => (<FormItem><FormLabel>IFSC Code*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="accountType" control={form.control} render={({ field }) => (<FormItem><FormLabel>Account Type*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select account type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="savings">Savings</SelectItem><SelectItem value="current">Current</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField name="companyId" control={form.control} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Link to Company (Optional)</FormLabel><Combobox options={companies} value={field.value || ""} onChange={(val) => field.onChange(val === "" ? null : val)} placeholder="Select company..." searchPlaceholder="Search companies..." disabled={isLoadingCompanies || companies.length === 0} emptyResultText="No companies found." /><FormMessage /></FormItem>)} />
              <FormField name="isDefault" control={form.control} render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Set as default</FormLabel><FormDescription>This account will be pre-selected for invoices.</FormDescription></div></FormItem>)} />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}


export default function BankAccountDetailPageWrapper({ params }: { params: { id: string } }) {
  const { id: accountId } = params;

  if (!accountId) {
    return <div>Invalid Bank Account ID.</div>;
  }
  
  return (
    <Suspense fallback={<BankAccountDetailLoadingSkeleton />}>
      <EditBankAccountClient accountId={accountId} />
    </Suspense>
  );
}
