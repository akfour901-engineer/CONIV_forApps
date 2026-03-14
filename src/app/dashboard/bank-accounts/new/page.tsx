
'use client';

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
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { BankAccount, Company, EnrichedUserProfile } from '@/types';
import { PlusCircle, Save, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import NewBankAccountLoadingSkeleton from './loading';
import { useState, useEffect, Suspense } from 'react';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { BANK_ACCOUNT_CREATION_COST } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

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

function NewBankAccountPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  const canCreateBankAccounts = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageBankAccounts;

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      accountHolderName: "", accountNumber: "", bankName: "", ifscCode: "", isDefault: false, companyId: null,
    },
  });

  useEffect(() => {
    if (user && dataOwnerId) {
      const fetchCompanies = async () => {
        setIsLoadingCompanies(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` },
          });
          if (response.ok) {
            const companiesData: Company[] = await response.json();
            setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name })));
          }
        } catch (error) {
          console.error("Failed to fetch companies:", error);
        } finally {
          setIsLoadingCompanies(false);
        }
      };
      fetchCompanies();
    }
  }, [user, dataOwnerId]);

  const onSubmit = async (values: BankAccountFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canCreateBankAccounts) {
        toast({ title: "Permission Denied", description: "You do not have permission to add bank accounts.", variant: "destructive" });
        return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === 'BANK_ACCOUNT_CREATION_COST')?.cost ?? BANK_ACCOUNT_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
      setPointsInfo({ required: cost, current: currentPoints });
      setIsPointsDialogOpen(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ...values, dataOwnerId: dataOwnerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }
        setIsSubmitting(false);
        return;
      }

      const createdAccountResult: BankAccount & { newResourcePoints?: number; cost?: number } = await response.json();

      if (updateGlobalUserProfile && userProfile && createdAccountResult.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        const newEnrichedProfile: Partial<EnrichedUserProfile> = {
            userProfile: {
                ...userProfile,
                resourcePoints: createdAccountResult.newResourcePoints,
                resourcePointsLastUpdated: new Date().toISOString()
            }
        };
        updateGlobalUserProfile(newEnrichedProfile);
      }

      toast({ title: "Success", description: `Bank account added successfully. Cost: ${createdAccountResult.cost || 'N/A'} points.` });
      router.push('/dashboard/bank-accounts');
    } catch (error: any) {
      console.error("Error adding bank account via API: ", error);
      toast({ title: "Error", description: `Failed to add bank account: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <NewBankAccountLoadingSkeleton />;
  }
  if (!user) {
    router.push('/auth/signin');
    return <NewBankAccountLoadingSkeleton />;
  }
  if (!canCreateBankAccounts) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to create new bank accounts.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New Bank Account
            </h1>
            <p className="text-muted-foreground">Enter the details for your new bank account.</p>
          </div>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
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
                <CardDescription>Fill in the information below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField 
                  control={form.control} 
                  name="accountHolderName" 
                  render={({ field }) => ( 
                    <FormItem> 
                      <FormLabel>Account Holder Name*</FormLabel> 
                      <FormControl> 
                        <Input placeholder="e.g., John Doe" {...field} /> 
                      </FormControl> 
                      <FormMessage /> 
                    </FormItem> 
                  )} 
                />
                <FormField 
                  control={form.control} 
                  name="accountNumber" 
                  render={({ field }) => ( 
                    <FormItem> 
                      <FormLabel>Account Number*</FormLabel> 
                      <FormControl> 
                        <Input placeholder="e.g., 1234567890" {...field} /> 
                      </FormControl> 
                      <FormMessage /> 
                    </FormItem> 
                  )} 
                />
                <FormField 
                  control={form.control} 
                  name="bankName" 
                  render={({ field }) => ( 
                    <FormItem> 
                      <FormLabel>Bank Name*</FormLabel> 
                      <FormControl> 
                        <Input placeholder="e.g., State Bank of India" {...field} /> 
                      </FormControl> 
                      <FormMessage /> 
                    </FormItem> 
                  )} 
                />
                <FormField 
                  control={form.control} 
                  name="ifscCode" 
                  render={({ field }) => ( 
                    <FormItem> 
                      <FormLabel>IFSC Code*</FormLabel> 
                      <FormControl> 
                        <Input placeholder="e.g., SBIN0001234" {...field} /> 
                      </FormControl> 
                      <FormMessage /> 
                    </FormItem> 
                  )} 
                />
                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type*</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="savings">Savings</SelectItem>
                            <SelectItem value="current">Current</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Link to Company (Optional)</FormLabel>
                       <Combobox
                        options={companies}
                        value={field.value || ""}
                        onChange={(val) => field.onChange(val === "" ? null : val)}
                        placeholder="Select company..."
                        searchPlaceholder="Search companies..."
                        disabled={isLoadingCompanies || companies.length === 0}
                        emptyResultText={isLoadingCompanies? "Loading companies..." : (companies.length === 0 ? "No companies found." : "No company found.")}
                       />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField 
                  control={form.control} 
                  name="isDefault" 
                  render={({ field }) => ( 
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm"> 
                      <FormControl> 
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} /> 
                      </FormControl> 
                      <div className="space-y-1 leading-none"> 
                        <FormLabel>Set as default bank account</FormLabel> 
                        <FormDescription>This account will be pre-selected for invoices.</FormDescription> 
                      </div> 
                    </FormItem> 
                  )} 
                />
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSubmitting ? "Saving..." : "Save Account"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}

function NewBankAccountPageWrapper() {
  return (
    <Suspense fallback={<NewBankAccountLoadingSkeleton />}>
      <NewBankAccountPageContent />
    </Suspense>
  )
}

export default NewBankAccountPageWrapper;
