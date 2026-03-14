
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
import type { Company, Organization, Invoice, InvoiceItem, InvoiceStatus, WorkOrder, SorRate, AppConfiguration, AISuggestedEstimateItem } from '@/types';
import { INVOICE_CREATION_COST, ORGANIZATION_CREATION_COST } from '@/lib/constants';
import { INVOICE_STATUS_OPTIONS } from '@/types';
import { FileText, PlusCircle, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, addDays } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import NewInvoicePageSkeleton from '@/app/dashboard/invoices/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { useLoading } from '@/contexts/loading-context';

const invoiceItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required.").default(""),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0.").default(1),
  unit: z.string().min(1, "Unit is required.").default("nos"),
  rate: z.coerce.number().min(0, "Rate must be non-negative.").default(0),
});

const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  companyId: z.string().min(1, "Your company is required."),
  organizationId: z.string().min(1, "Client organization is required."),
  date: z.date({ required_error: "Invoice date is required." }),
  dueDate: z.date({ required_error: "Due date is required." }),
  status: z.enum(INVOICE_STATUS_OPTIONS, { required_error: "Status is required." }).default('draft'),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required."),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  amountPaid: z.coerce.number().min(0).optional().default(0),
  paymentInstructions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  workOrderIdForLinking: z.string().optional().nullable(),
  workOrderNumber: z.string().optional().nullable(),
  paymentProofUrl: z.string().optional().nullable(),
}).refine(data => !data.dueDate || !data.date || data.dueDate >= data.date, {
  message: "Due date cannot be before invoice date.",
  path: ["dueDate"],
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
const DEFAULT_INVOICE_ITEMS_FORM = [{ itemCode: "", description: "", quantity: 1, unit: "nos", rate: 0, id: 'default-0' }];

function NewInvoicePageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
  const [isLoadingSorRates, setIsLoadingSorRates] = useState(false);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');

  const canCreateInvoices = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateInvoices;
  
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000) + 1).padStart(4, '0')}`,
      date: new Date(),
      dueDate: addDays(new Date(), 15),
      status: 'draft',
      items: DEFAULT_INVOICE_ITEMS_FORM,
      taxRate: 0,
      amountPaid: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  
  const fetchPrerequisitesAndPrefill = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    
    setIsLoadingDropdowns(true);
    setGlobalIsLoading(true);

    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/invoices/form-data?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch required data for invoices.');

        const data = await response.json();
        
        setCompanies(data.companies.map((c:Company) => ({ value: c.id!, label: c.name, data: c })));
        setOrganizations(data.organizations.map((o:Organization) => ({ value: o.id!, label: o.name, data: o })));
        setWorkOrders(data.workOrders.map((wo:WorkOrder) => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}`, data: wo })));
        setAvailableSorItems(data.sorRates);
        
        const workOrderId = searchParams?.get('workOrderId');
        if (workOrderId) {
            const woToLink: WorkOrder | undefined = data.workOrders.find((wo: WorkOrder) => wo.id === workOrderId);
            if(woToLink) {
                form.reset({
                    ...form.getValues(),
                    companyId: woToLink.companyId,
                    organizationId: woToLink.organizationId,
                    items: woToLink.items.map(item => ({ ...item, id: undefined, amount: item.rate * item.quantity })),
                    workOrderIdForLinking: woToLink.id,
                    workOrderNumber: woToLink.workOrderNumber,
                });
                toast({ title: "Work Order Linked", description: `Invoice pre-filled from Work Order ${woToLink.workOrderNumber}.` });
            }
        }
    } catch (error: any) {
        toast({ title: "Error", description: "Could not load required data.", variant: "destructive" });
    } finally {
        setIsLoadingDropdowns(false);
        setGlobalIsLoading(false);
    }
  }, [user, dataOwnerId, toast, searchParams, form, setGlobalIsLoading]);

  useEffect(() => {
    if (user && dataOwnerId && canCreateInvoices) {
      fetchPrerequisitesAndPrefill();
    }
  }, [user, dataOwnerId, canCreateInvoices, fetchPrerequisitesAndPrefill]);

  const calculateTotals = () => {
    const items = form.getValues("items") || [];
    const taxRate = form.getValues("taxRate") || 0;
    const amountPaid = form.getValues("amountPaid") || 0;
    const subTotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0);
    const taxAmount = (subTotal * taxRate) / 100;
    const grandTotal = subTotal + taxAmount;
    const balanceDue = grandTotal - amountPaid;
    return { subTotal, taxAmount, grandTotal, balanceDue };
  };

  form.watch(["items", "taxRate", "amountPaid"]);
  const { subTotal, taxAmount, grandTotal, balanceDue } = calculateTotals();

  const onSubmit = async (values: InvoiceFormValues) => {
    setIsSubmitting(true);
    setGlobalIsLoading(true);
    if (!user || !dataOwnerId || !form.getValues("companyId") || !form.getValues("organizationId") || !userProfile || !appConfig) {
      toast({ title: "Missing Information", description: "User, company, or organization details are incomplete.", variant: "destructive" });
      setIsSubmitting(false);
      setGlobalIsLoading(false);
      return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === 'INVOICE_CREATION_COST')?.cost || INVOICE_CREATION_COST;
    const currentPoints = userProfile.resourcePoints || 0;
    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
    }

    const invoiceDataForApi = {
      ...values,
      dataOwnerId: dataOwnerId,
      date: format(values.date, 'yyyy-MM-dd'),
      dueDate: format(values.dueDate, 'yyyy-MM-dd'),
    };

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(invoiceDataForApi),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `API request failed.`);
      
      if (updateGlobalUserProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile(
          { 
            userProfile: { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }, 
            teamMemberPermissions: currentTeamMemberPermissions,
            teamOwnerProfileData: null 
          }
        );
      }

      toast({ title: "Success", description: `Invoice created successfully. Cost: ${result.cost || 'N/A'} points.` });
      
      router.push('/dashboard/invoices');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSorItems = useMemo(() => {
    const currentItemDescriptions = new Set((form.watch('items') || []).map(item => item.description));
    return availableSorItems
      .filter(sor => !currentItemDescriptions.has(sor.itemDescription))
      .filter(sor => 
        (sor.itemDescription?.toLowerCase() || '').includes(currentSearchTerm.toLowerCase()) ||
        (sor.itemCode?.toLowerCase() || '').includes(currentSearchTerm.toLowerCase())
      )
      .slice(0, 5)
  }, [availableSorItems, currentSearchTerm, form]);
  
  const handleSorSelect = useCallback((index: number, sor: SorRate) => { form.setValue(`items.${index}.itemCode`, sor.itemCode || ""); form.setValue(`items.${index}.description`, sor.itemDescription || ""); form.setValue(`items.${index}.unit`, sor.unit || "nos"); form.setValue(`items.${index}.rate`, sor.rate || 0); setActivePopoverIndex(null); setCurrentSearchTerm(''); }, [form]);
  
  if (authLoading && !userProfile) return <NewInvoicePageSkeleton />;
  if (!user || !userProfile || !dataOwnerId) { router.push('/auth/signin'); return <NewInvoicePageSkeleton />; }
  
  if (!canCreateInvoices) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"> <AlertTriangle className="w-16 h-16 text-destructive mb-4" /> <h2 className="text-xl font-semibold">Permission Denied</h2> <p className="text-muted-foreground">You do not have permission to create new invoices.</p> <Button asChild className="mt-4" onClick={() => setGlobalIsLoading(true)}> <Link href="/dashboard/invoices">Back to Invoices</Link> </Button> </div> );
  }
  
  const isLoadingForm = isLoadingDropdowns || isLoadingSorRates || isCreatingOrg;
  
  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <main className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center">
            <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Create New Invoice
          </h1>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices</Link>
          </Button>
        </div>
        
        {isLoadingDropdowns ? <NewInvoicePageSkeleton /> : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Your Company*</FormLabel><Combobox options={companies} value={field.value} onChange={(value) => field.onChange(value)} placeholder="Select company..."/></FormItem>)}/>
                <FormField control={form.control} name="organizationId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Client Organization*</FormLabel><Combobox options={organizations} value={field.value} onChange={(value) => field.onChange(value)} placeholder="Select client..."/><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="invoiceNumber" render={({field}) => (<FormItem><FormLabel>Invoice Number*</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{INVOICE_STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s.replace("-"," ")}</SelectItem>))}</SelectContent></Select></FormItem>)}/>
                <FormField control={form.control} name="date" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>Invoice Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : "Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)}/>
                <FormField control={form.control} name="dueDate" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>Due Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : "Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)}/>
                <FormField control={form.control} name="workOrderIdForLinking" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Link to Work Order (Optional)</FormLabel><Combobox options={workOrders} value={field.value || ""} onChange={(value) => field.onChange(value === "" ? null : value)} placeholder="Select Work Order..."/></FormItem>)}/>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Invoice Items</CardTitle></CardHeader>
              <CardContent>
                {fields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md mb-4 space-y-2 relative">
                     <div className="flex justify-between items-center"><h5 className="font-medium">Item #{index + 1}</h5><Button type="button" variant="ghost" size="icon" onClick={()=>remove(index)}><Trash2 className="h-4 w-4"/></Button></div>
                     <Controller control={form.control} name={`items.${index}.description`} render={({field}) => (<FormItem><FormLabel>Description*</FormLabel><Popover open={activePopoverIndex === index} onOpenChange={(open) => setActivePopoverIndex(open ? index : null)}><PopoverTrigger asChild><FormControl><Input placeholder="Item description or search SOR..." {...field} value={field.value ?? ""} /></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search SOR..." onValueChange={setCurrentSearchTerm}/><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup>{filteredSorItems.map((sor) => (<CommandItem key={sor.id} value={sor.itemDescription} onSelect={() => handleSorSelect(index, sor)}>{sor.itemDescription}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                     <div className="grid sm:grid-cols-3 gap-4">
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({field}) => (<FormItem><FormLabel>Quantity*</FormLabel><FormControl><Input type="number" placeholder="1" {...field}/></FormControl></FormItem>)}/>
                        <FormField control={form.control} name={`items.${index}.unit`} render={({field}) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input placeholder="e.g., nos, kg" {...field}/></FormControl></FormItem>)}/>
                        <FormField control={form.control} name={`items.${index}.rate`} render={({field}) => (<FormItem><FormLabel>Rate (₹)*</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field}/></FormControl></FormItem>)}/>
                     </div>
                     <div className="text-right font-medium">Amount: {formatCurrency((form.watch(`items.${index}.quantity`)||0) * (form.watch(`items.${index}.rate`)||0) )}</div>
                  </div>
                ))}
                <Button type="button" onClick={() => append(DEFAULT_INVOICE_ITEMS_FORM[0])}>Add Item</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Summary & Terms</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <FormField control={form.control} name="notes" render={({field}) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                    <FormField control={form.control} name="paymentInstructions" render={({field}) => (<FormItem><FormLabel>Payment Instructions</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={5} /></FormControl></FormItem>)}/>
                  </div>
                  <Card className="p-4 bg-secondary/50">
                      <CardContent className="space-y-2 p-0">
                          <div className="flex justify-between"><span>Subtotal:</span><span className="font-medium">{formatCurrency(subTotal)}</span></div>
                          <FormField control={form.control} name="taxRate" render={({field}) => (<FormItem className="flex justify-between items-center"><FormLabel>Tax Rate (%):</FormLabel><FormControl><Input type="number" className="w-24 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem>)}/>
                          <div className="flex justify-between"><span>Tax Amount:</span><span className="font-medium">{formatCurrency(taxAmount)}</span></div>
                          <hr className="my-2 border-border" />
                          <div className="flex justify-between text-lg font-bold text-primary"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                           <FormField control={form.control} name="amountPaid" render={({field}) => (<FormItem className="flex justify-between items-center border-t pt-2 mt-2"><FormLabel>Amount Paid:</FormLabel><FormControl><Input type="number" className="w-32 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem>)}/>
                          <hr className="my-2 border-border" />
                          <div className="flex justify-between text-lg font-bold text-destructive"><span>Balance Due:</span><span>{formatCurrency(balanceDue)}</span></div>
                      </CardContent>
                  </Card>
              </CardContent>
              <CardFooter><Button type="submit" disabled={isSubmitting || isLoadingForm || authLoading || !canCreateInvoices}>{isSubmitting || isLoadingForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}{isSubmitting || isLoadingForm ? "Saving..." : "Save Invoice"}</Button></CardFooter>
            </Card>
          </form>
        </Form>
        )}
      </main>
    </>
  );
}

export default function NewInvoicePageWrapper() {
  return (
    <Suspense fallback={<NewInvoicePageSkeleton />}>
      <NewInvoicePageContent />
    </Suspense>
  );
}
