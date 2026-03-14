
'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Company, Organization, Estimate, EstimateItem, EstimateStatus, SorRate, WorkOrder } from '@/types/server-only';
import { ESTIMATE_STATUS_OPTIONS } from '@/types/server-only';
import { Edit, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, PlusCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, addDays } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import EditEstimatePageSkeleton from '@/app/dashboard/estimates/[id]/edit/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { useLoading } from '@/contexts/loading-context';

const estimateItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required.").default(""),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0.").default(1),
  unit: z.string().min(1, "Unit is required.").default("nos"),
  rate: z.coerce.number().min(0, "Rate must be non-negative.").default(0),
  amount: z.coerce.number(),
});


const estimateUpdateSchema = z.object({
  estimateNumber: z.string().min(1, "Estimate number is required.").optional(),
  subjectOfWork: z.string().max(500).optional().nullable(),
  date: z.date().optional(),
  validUntil: z.date().optional().nullable(),
  companyId: z.string().min(1, "Company ID is required.").optional(),
  organizationId: z.string().min(1, "Organization ID is required.").optional(),
  status: z.enum(ESTIMATE_STATUS_OPTIONS as [string, ...string[]]).optional(),
  items: z.array(estimateItemSchema).min(1, "At least one item is required.").optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  discount: z.coerce.number().min(0, "Discount must be non-negative.").optional().nullable(),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).refine(data => !data.validUntil || !data.date || data.validUntil >= data.date, {
  message: "Valid until date cannot be before estimate date.",
  path: ["validUntil"],
});


type EstimateFormValues = z.infer<typeof estimateUpdateSchema>;

const DEFAULT_ESTIMATE_ITEMS_FORM = [{ itemCode: "", description: "", quantity: 1, unit: "nos", rate: 0, id: 'default-0', amount: 0 }];

export function EditEstimatePageContent({ estimateId }: { estimateId: string }) {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  
  const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
  const [isLoadingSorRates, setIsLoadingSorRates] = useState(false);
  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const canEditEstimates = isViewingOwnAccount || !!currentTeamMemberPermissions?.canEditEstimates;
  
  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateUpdateSchema),
    defaultValues: {
      items: DEFAULT_ESTIMATE_ITEMS_FORM,
      taxRate: 0,
    } as any,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  
  const fetchPrerequisitesAndPrefill = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    
    setIsLoadingDropdowns(true);
    setGlobalIsLoading(true);

    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/estimates/form-data?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch required data for estimates.');
        const data = await response.json();
        
        setCompanies(data.companies.map((c:Company) => ({ value: c.id!, label: c.name, data: c })));
        
        const orgsData: Organization[] = data.organizations;
        const orgOptionsMap = new Map<string, ComboboxOption>();
        orgsData.forEach(org => orgOptionsMap.set(org.id!, { value: org.id!, label: org.name, data: org }));
        setOrganizations(Array.from(orgOptionsMap.values()).sort((a, b) => a.label.localeCompare(b.label)));

        setAvailableSorItems(data.sorRates);

        const estimateResponse = await fetch(`/api/estimates/${estimateId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!estimateResponse.ok) throw new Error('Failed to fetch estimate data.');
        const estimateData: Estimate = await estimateResponse.json();

        setEstimate(estimateData);
        form.reset({
          ...estimateData,
          date: new Date(estimateData.date),
          validUntil: estimateData.validUntil ? new Date(estimateData.validUntil) : null,
          items: estimateData.items.map(item => ({ ...item, id: Math.random().toString() })),
        });
        
    } catch (error: any) {
        toast({ title: "Error", description: "Could not load required data.", variant: "destructive" });
        router.push('/dashboard/estimates');
    } finally {
        setIsLoadingDropdowns(false);
        setGlobalIsLoading(false);
    }
  }, [user, dataOwnerId, toast, estimateId, form, setGlobalIsLoading, router]);

  useEffect(() => {
    if(user && dataOwnerId && canEditEstimates) {
        fetchPrerequisitesAndPrefill();
    }
  }, [user, dataOwnerId, canEditEstimates, fetchPrerequisitesAndPrefill]);

  const calculateTotals = () => {
    const items = form.getValues("items") || [];
    const discount = form.getValues("discount") || 0;
    const taxRate = form.getValues("taxRate") || 0;
    const subTotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0);
    const taxableValue = subTotal - discount;
    const taxAmount = (taxableValue * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    return { subTotal, taxableValue, taxAmount, grandTotal };
  };

  form.watch(["items", "discount", "taxRate"]);
  const { subTotal, taxableValue, taxAmount, grandTotal } = calculateTotals();

  const onSubmit = async (values: EstimateFormValues) => {
    setIsSubmitting(true);
    setGlobalIsLoading(true);
    if (!user || !dataOwnerId || !form.getValues("companyId") || !form.getValues("organizationId")) {
      toast({ title: "Missing Information", description: "User, company, or organization details are incomplete.", variant: "destructive" });
      setIsSubmitting(false);
      setGlobalIsLoading(false);
      return;
    }

    const itemsWithAmounts = (values.items || []).map(item => ({
        ...item,
        amount: (item.quantity || 0) * (item.rate || 0),
    }));

    const estimateDataForApi = {
      ...values,
      items: itemsWithAmounts,
      dataOwnerId: dataOwnerId,
      date: values.date ? format(values.date, 'yyyy-MM-dd') : undefined,
      validUntil: values.validUntil ? format(values.validUntil, 'yyyy-MM-dd') : null,
      taxRate: values.taxRate ?? 0,
    };

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/estimates/${estimateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(estimateDataForApi),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed.`);
      }
      
      toast({ title: "Success", description: `Estimate updated successfully.` });
      
      router.push('/dashboard/estimates');
    } catch (error: any) {
      console.error("Error creating estimate (via API): ", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const filteredSorItems = useMemo(() =>
    availableSorItems
      .filter(sor =>
        (sor.itemDescription?.toLowerCase() || '').includes(currentSearchTerm.toLowerCase()) ||
        (sor.itemCode?.toLowerCase() || '').includes(currentSearchTerm.toLowerCase())
      )
      .slice(0, 5)
  , [availableSorItems, currentSearchTerm]);

  const handleSorSelect = useCallback((index: number, sor: SorRate) => {
    form.setValue(`items.${index}.itemCode`, sor.itemCode || "");
    form.setValue(`items.${index}.description`, sor.itemDescription || "");
    form.setValue(`items.${index}.unit`, sor.unit || "nos");
    form.setValue(`items.${index}.rate`, sor.rate || 0);
    setActivePopoverIndex(null);
    setCurrentSearchTerm('');
  }, [form]);
  
  if (authLoading || isLoadingDropdowns) return <EditEstimatePageSkeleton />;
  if (!user || !userProfile || !dataOwnerId) { router.push('/auth/signin'); return <EditEstimatePageSkeleton />; }
  
  if (!canEditEstimates) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to edit estimates.</p>
        <Button asChild className="mt-4" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/estimates">Back to Estimates</Link>
        </Button>
      </div>
    );
  }
  
  const isLoadingForm = isLoadingDropdowns || isLoadingSorRates || isCreatingOrg;

  return (
    <main className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Edit className="mr-3 h-7 w-7 text-primary" /> Edit Estimate
          </h1>
          <p className="text-muted-foreground">Modify estimate: {estimate?.estimateNumber}</p>
        </div>
        <Button variant="outline" asChild className="w-full sm:w-auto" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/estimates">
            <span className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Estimates
            </span>
          </Link>
        </Button>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Estimate Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Your Company*</FormLabel><Combobox options={companies} {...field} placeholder="Select company..."/></FormItem>)}/>
              <FormField control={form.control} name="organizationId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Client Organization*</FormLabel><Combobox options={organizations} {...field} placeholder="Select client..."/><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="subjectOfWork" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Subject of Work</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={2} /></FormControl></FormItem>)}/>
              <FormField control={form.control} name="estimateNumber" render={({ field }) => (<FormItem><FormLabel>Estimate Number*</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
              <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{ESTIMATE_STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}</SelectContent></Select></FormItem>)}/>
              <FormField control={form.control} name="date" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Estimate Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP"):"Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)}/>
              <FormField control={form.control} name="validUntil" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid Until</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP"):"Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} disabled={(date) => date < (form.getValues("date") || new Date())} /></PopoverContent></Popover></FormItem>)}/>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Estimate Items</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {fields.map((item, index) => (
                <div key={item.id} className="p-4 border rounded-md shadow-sm space-y-3">
                  <div className="flex justify-between items-center"><h4 className="font-medium">Item #{index + 1}</h4>{fields.length > 1 && (<Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>)}</div>
                  <Controller control={form.control} name={`items.${index}.description`} render={({field}) => (<FormItem><FormLabel>Description*</FormLabel><Popover open={activePopoverIndex === index} onOpenChange={(open) => setActivePopoverIndex(open ? index : null)}><PopoverTrigger asChild><FormControl><Input placeholder="Item description or search SOR..." {...field} /></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search SOR..." onValueChange={setCurrentSearchTerm}/><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup>{filteredSorItems.map((sor) => (<CommandItem key={sor.id} value={sor.itemDescription} onSelect={() => handleSorSelect(index, sor)}>{sor.itemDescription}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name={`items.${index}.quantity`} render={({field}) => (<FormItem><FormLabel>Quantity*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                    <FormField control={form.control} name={`items.${index}.unit`} render={({field}) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>)}/>
                    <FormField control={form.control} name={`items.${index}.rate`} render={({field}) => (<FormItem><FormLabel>Rate ({formatCurrency(0).charAt(0)})*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                  </div>
                  <div className="text-right font-medium">Item Amount: {formatCurrency((form.watch(`items.${index}.quantity`) || 0) * (form.watch(`items.${index}.rate`) || 0))}</div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => append({ itemCode: "", description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Summary & Terms</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <FormField control={form.control} name="notes" render={({field}) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={3} /></FormControl></FormItem>)}/>
                <FormField control={form.control} name="termsAndConditions" render={({field}) => (<FormItem><FormLabel>Terms & Conditions</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={5} /></FormControl></FormItem>)}/>
              </div>
              <Card className="p-4 bg-secondary/50">
                  <CardContent className="space-y-2 p-0">
                      <div className="flex justify-between"><span>Subtotal:</span><span className="font-medium">{formatCurrency(subTotal)}</span></div>
                      <FormField control={form.control} name="discount" render={({ field }) => (<FormItem className="flex justify-between items-center"><FormLabel className="mb-0 whitespace-nowrap mr-2">Discount (₹):</FormLabel><FormControl><Input type="number" placeholder="0.00" className="w-24 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                       <div className="flex justify-between"><span>Taxable Value:</span><span className="font-medium">{formatCurrency(taxableValue)}</span></div>
                      <FormField control={form.control} name="taxRate" render={({field}) => (<FormItem className="flex justify-between items-center"><FormLabel className="mb-0 whitespace-nowrap mr-2">Tax Rate (%):</FormLabel><FormControl><Input type="number" className="w-24 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem>)}/>
                      <div className="flex justify-between"><span>Tax Amount:</span><span className="font-medium">{formatCurrency(taxAmount)}</span></div>
                      <hr className="my-2 border-border" />
                      <div className="flex justify-between text-lg font-bold text-primary"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                  </CardContent>
              </Card>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting || isLoadingForm || authLoading || !canEditEstimates}>{isSubmitting || isLoadingForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}{isSubmitting || isLoadingForm ? "Saving..." : "Update Estimate"}</Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </main>
  )
}
