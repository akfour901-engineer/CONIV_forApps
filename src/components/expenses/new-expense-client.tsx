'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Company, WorkOrder, Expense, TeamPermissions } from '@/types';
import { PlusCircle, Save, Loader2, CalendarIcon, UploadCloud, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import NewExpensePageSkeleton from '@/app/dashboard/expenses/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { EXPENSE_RECORDING_COST, EXPENSE_CATEGORY_OPTIONS } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const expenseFormSchema = z.object({
  date: z.date({ required_error: "Expense date is required." }),
  category: z.string().min(1, "Category is required.").max(100),
  description: z.string().min(1, "Description is required.").max(500),
  amount: z.coerce.number().positive("Amount must be positive."),
  receiptUrl: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  workOrderId: z.string().optional().nullable(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export default function NewExpensePageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canCreateExpenses = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageExpenses;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { date: new Date(), category: "", description: "", amount: 0, receiptUrl: null, companyId: null, workOrderId: null },
  });

  const companyIdFromForm = form.watch("companyId");
  const workOrderIdFromUrl = searchParams?.get('workOrderId');
  
  const fetchRelatedData = useCallback(async () => {
    if (user && dataOwnerId) {
      setIsLoadingDropdowns(true);
      try {
        const idToken = await user.getIdToken();
        const [companyResponse, woResponse] = await Promise.all([
          fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
          fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
        ]);

        if (!companyResponse.ok) throw new Error('Failed to fetch companies');
        const companiesData: Company[] = await companyResponse.json();
        setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name, data: c })));

        if (!woResponse.ok) throw new Error('Failed to fetch work orders');
        const workOrdersData: WorkOrder[] = await woResponse.json();
        setWorkOrders(workOrdersData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}`, data: wo})));
        
        if (workOrderIdFromUrl) {
            const linkedWO = workOrdersData.find(wo => wo.id === workOrderIdFromUrl);
            if (linkedWO) {
                form.setValue('workOrderId', linkedWO.id!);
                if (linkedWO.companyId) {
                    form.setValue('companyId', linkedWO.companyId);
                }
            }
        }
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Could not load company/work order data.", variant: "destructive" });
      } finally {
        setIsLoadingDropdowns(false);
      }
    }
  }, [user, dataOwnerId, toast, workOrderIdFromUrl, form]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);
  
  const handleReceiptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Receipt file cannot exceed ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if(receiptFileRef.current) receiptFileRef.current.value = "";
        form.setValue('receiptUrl', null); setSelectedFileName(null); return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('receiptUrl', reader.result as string, { shouldValidate: true });
        setSelectedFileName(file.name);
      };
      reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: ExpenseFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canCreateExpenses) {
        toast({ title: "Permission Denied", description: "You do not have permission to add expenses.", variant: "destructive" });
        return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === "EXPENSE_RECORDING_COST")?.cost ?? EXPENSE_RECORDING_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
    }

    setIsSubmitting(true);
    const expenseDataToSave = {
      ...values,
      date: format(values.date, 'yyyy-MM-dd'),
      dataOwnerId: dataOwnerId,
    };
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(expenseDataToSave),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || 'Failed to record expense.');
        }
        setIsSubmitting(false);
        return;
      }
      
      const createdExpenseResult: Expense & { newResourcePoints?: number; cost?: number } = await response.json();
      
      if (updateGlobalUserProfile && userProfile && createdExpenseResult.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: createdExpenseResult.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }});
      }

      toast({ title: "Success", description: `Expense recorded successfully. Cost: ${createdExpenseResult.cost || 'N/A'} points.` });
      
      router.push('/dashboard/expenses');
    } catch (error: any) {
      console.error("Error recording expense (via API): ", error);
      toast({ title: "Error Recording Expense", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoadingDropdowns) return <NewExpensePageSkeleton />;
  if (!user || !userProfile) { router.push('/auth/signin'); return <NewExpensePageSkeleton />; }
  
  if (!canCreateExpenses) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to add new expenses.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/expenses">Back to Expenses</Link></Button>
      </div>
    );
  }

  const filteredWorkOrders = companyIdFromForm ? workOrders.filter(wo => wo.data.companyId === companyIdFromForm) : workOrders;

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Log New Expense
            </h1>
            <p className="text-muted-foreground">Record a new business expense.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/expenses"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Expenses</Link>
          </Button>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader><CardTitle>Expense Details</CardTitle><CardDescription>Fill in the information for the expense.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="date" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Expense Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category*</FormLabel><FormControl><Input placeholder="e.g., Materials, Fuel, Labour, Subcontractor" {...field} list="expenseCategories" /></FormControl><datalist id="expenseCategories">{EXPENSE_CATEGORY_OPTIONS.map(c => <option key={c} value={c} />)}</datalist><FormDescription>Enter a category for this expense.</FormDescription><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description*</FormLabel><FormControl><Textarea placeholder="e.g., Cement bags for Site A, Diesel for generator" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (₹)*</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormItem>
                  <FormLabel htmlFor="receiptUpload">Upload Receipt (Optional)</FormLabel>
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <span> {/* Span wrapper */}
                        <Input
                          id="receiptUpload"
                          type="file"
                          accept="image/*,application/pdf"
                          ref={receiptFileRef}
                          onChange={handleReceiptUpload}
                          className="flex-grow"
                        />
                      </span>
                    </FormControl>
                    <Button type="button" variant="outline" onClick={() => receiptFileRef.current?.click()} className="shrink-0"><UploadCloud className="mr-2 h-4 w-4" /> Choose File</Button>
                  </div>
                  <FormDescription>
                    Max file size: {MAX_FILE_SIZE_MB}MB. The file will be saved as part of the expense record.
                    {selectedFileName && <span className="text-green-600 block mt-1">Selected: {selectedFileName}</span>}
                  </FormDescription>
                </FormItem>
                <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Associate with Company (Optional)</FormLabel><Combobox options={companies} value={field.value || ""} onChange={(val) => field.onChange(val === "" ? null : val)} placeholder="Select company..." searchPlaceholder="Search companies..." disabled={isLoadingDropdowns || companies.length === 0} emptyResultText={isLoadingDropdowns ? "Loading companies..." : (companies.length === 0 ? "No companies found." : "No company found.")} /><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="workOrderId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Link to Work Order (Optional)</FormLabel><Combobox options={filteredWorkOrders} value={field.value || ""} onChange={(val) => field.onChange(val === "" ? null : val)} placeholder="Select work order..." searchPlaceholder="Search work orders..." disabled={isLoadingDropdowns || workOrders.length === 0} emptyResultText={isLoadingDropdowns ? "Loading work orders..." : "No work orders found."} /><FormDescription>Filtered by selected company if any.</FormDescription><FormMessage /></FormItem>)} />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || isLoadingDropdowns}>
                  {isSubmitting || isLoadingDropdowns ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : (<><Save className="mr-2 h-4 w-4" /> Save Expense</>)}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}
