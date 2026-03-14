
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
  FormDescription,
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
import type { Company, Organization, Estimate, WorkOrder, WorkOrderItem, WorkOrderStatus, SorRate, AppConfiguration, AISuggestedEstimateItem, EstimateItem } from '@/types/server-only';
import { WORK_ORDER_CREATION_COST, ORGANIZATION_CREATION_COST } from '@/lib/constants';
import { WORK_ORDER_STATUS_OPTIONS } from '@/types/server-only';
import { ClipboardList, PlusCircle, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import NewWorkOrderPageSkeleton from '@/app/dashboard/work-orders/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { useLoading } from '@/contexts/loading-context';

const workOrderItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required.").default(""),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0.").default(1),
  unit: z.string().min(1, "Unit is required.").default("nos"),
  rate: z.coerce.number().min(0, "Rate must be non-negative.").default(0),
  amount: z.number(),
});

const workOrderFormSchema = z.object({
  workOrderNumber: z.string().min(1, "Work Order number is required.").max(100),
  companyId: z.string().min(1, "Your company is required."),
  organizationId: z.string().min(1, "Client organization is required."),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
  securityDeposit: z.coerce.number().optional().nullable(),
  depositPeriod: z.coerce.number().int().optional().nullable(),
  scopeOfWork: z.string().max(5000).optional().nullable(),
  status: z.enum(WORK_ORDER_STATUS_OPTIONS as [string, ...string[]]).default('draft'),
  items: z.array(workOrderItemSchema).min(1, "At least one item is required."),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  awardProofUrl: z.string().optional().nullable(),
  estimateId: z.string().optional().nullable(),
}).refine(data => !data.endDate || !data.startDate || data.endDate >= data.startDate, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});


type WorkOrderFormValues = z.infer<typeof workOrderFormSchema>;

const DEFAULT_WO_ITEMS_FORM = [{ itemCode: "", description: "", type: 'material' as const, quantity: 1, unit: "nos", rate: 0, id: 'default-0', amount: 0 }];

function NewWorkOrderPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  const [approvedEstimates, setApprovedEstimates] = useState<ComboboxOption[]>([]);
  const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
  const [isLoadingSorRates, setIsLoadingSorRates] = useState(false);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');

  const canCreateWorkOrders = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateWorkOrders;
  
  const defaultFormValues: WorkOrderFormValues = useMemo(() => ({
    workOrderNumber: `WO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000) + 1).padStart(4, '0')}`,
    startDate: new Date(),
    endDate: addDays(new Date(), 30),
    companyId: "",
    organizationId: "",
    status: 'draft',
    items: DEFAULT_WO_ITEMS_FORM,
    taxRate: 0,
  }), []);

  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: defaultFormValues,
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  
  const fetchPrerequisitesAndPrefill = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    
    setIsLoadingDropdowns(true);
    setGlobalIsLoading(true);

    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/work-orders/form-data?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch required data for work orders.');

        const data = await response.json();
        
        setCompanies(data.companies.map((c:Company) => ({ value: c.id!, label: c.name, data: c })));
        
        const orgsData: Organization[] = data.organizations;
        const orgOptionsMap = new Map<string, ComboboxOption>();
        orgsData.forEach(org => orgOptionsMap.set(org.id!, { value: org.id!, label: org.name, data: org }));
        setOrganizations(Array.from(orgOptionsMap.values()).sort((a, b) => a.label.localeCompare(b.label)));

        setApprovedEstimates(data.estimates.map((e: Estimate) => ({ value: e.id!, label: `${e.estimateNumber} - ${e.organizationName}`, data: e })));

        setAvailableSorItems(data.sorRates);
        
        const templateEstimateId = searchParams?.get('templateEstimateId');
        const templateWorkOrderId = searchParams?.get('templateWorkOrderId');

        if (templateEstimateId) {
            const template = data.estimates.find((e: Estimate) => e.id === templateEstimateId);
            if (template && template.userId === dataOwnerId) {
                const duration = template.validUntil ? differenceInDays(new Date(template.validUntil), new Date(template.date)) : 30;
                form.reset({
                    ...defaultFormValues,
                    companyId: template.companyId,
                    organizationId: template.organizationId,
                    items: template.items.map((item: EstimateItem) => ({...item, id: undefined, amount: item.quantity * item.rate })),
                    taxRate: template.taxRate,
                    scopeOfWork: template.subjectOfWork,
                    termsAndConditions: template.termsAndConditions,
                    estimateId: template.id,
                    startDate: new Date(),
                    endDate: addDays(new Date(), duration),
                });
                toast({ title: "Template Loaded", description: `Details from estimate ${template.estimateNumber} pre-filled.` });
            }
        } else if (templateWorkOrderId) {
            // Find logic for Work Order Template - Assuming workOrders are also fetched in form-data
            const template = data.workOrders?.find((wo: WorkOrder) => wo.id === templateWorkOrderId);
            if (template) {
                const duration = differenceInDays(new Date(template.endDate), new Date(template.startDate));
                form.reset({
                    ...defaultFormValues,
                    companyId: template.companyId,
                    organizationId: template.organizationId,
                    items: template.items.map((item: WorkOrderItem) => ({...item, id: undefined, amount: item.quantity * item.rate })),
                    taxRate: template.taxRate,
                    scopeOfWork: template.scopeOfWork,
                    termsAndConditions: template.termsAndConditions,
                    estimateId: template.estimateId,
                    startDate: new Date(),
                    endDate: addDays(new Date(), duration >= 0 ? duration : 30),
                });
                toast({ title: "Template Loaded", description: `Details from work order ${template.workOrderNumber} pre-filled.` });
            }
        }
    } catch (error: any) {
        toast({ title: "Error", description: "Could not load required data.", variant: "destructive" });
    } finally {
        setIsLoadingDropdowns(false);
        setGlobalIsLoading(false);
    }
  }, [user, dataOwnerId, toast, searchParams, form, defaultFormValues, setGlobalIsLoading]);

  useEffect(() => {
    if (user && dataOwnerId && canCreateWorkOrders) {
        fetchPrerequisitesAndPrefill();
    }
  }, [user, dataOwnerId, canCreateWorkOrders, fetchPrerequisitesAndPrefill]);
  
  const onSubmit = async (values: WorkOrderFormValues) => {
    setIsSubmittingForm(true);
    setGlobalIsLoading(true);
    if (!user || !dataOwnerId || !form.getValues("companyId") || !form.getValues("organizationId") || !userProfile || !appConfig) {
      toast({ title: "Missing Information", description: "User, company, or organization details are incomplete.", variant: "destructive" });
      setIsSubmittingForm(false);
      setGlobalIsLoading(false);
      return;
    }

    const cost = appConfig.actionCosts?.find(c => c.key === 'WORK_ORDER_CREATION_COST')?.cost || WORK_ORDER_CREATION_COST;
    const currentPoints = userProfile.resourcePoints || 0;
    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        setIsSubmittingForm(false);
        setGlobalIsLoading(false);
        return;
    }

    const woDataForApi = {
      ...values,
      dataOwnerId: dataOwnerId,
      startDate: format(values.startDate, 'yyyy-MM-dd'),
      endDate: format(values.endDate, 'yyyy-MM-dd'),
    };

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(woDataForApi),
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

      toast({ title: "Success", description: `Work Order created successfully. Cost: ${result.cost || 'N/A'} points.` });
      
      router.push('/dashboard/work-orders');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const calculateTotals = () => {
    const items = form.getValues("items") || [];
    const taxRate = form.getValues("taxRate") || 0;
    const subTotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0);
    const taxAmount = (subTotal * taxRate) / 100;
    return { subTotal, taxAmount, grandTotal: subTotal + taxAmount };
  };
  form.watch(["items", "taxRate"]);
  const { subTotal, taxAmount, grandTotal } = calculateTotals();

  const filteredSorItems = useMemo(() => availableSorItems.filter(sor => sor.itemDescription.toLowerCase().includes(currentSearchTerm.toLowerCase())).slice(0, 5), [availableSorItems, currentSearchTerm]);
  const handleSorSelect = useCallback((index: number, sor: SorRate) => { form.setValue(`items.${index}.itemCode`, sor.itemCode || ""); form.setValue(`items.${index}.description`, sor.itemDescription || ""); form.setValue(`items.${index}.unit`, sor.unit || "nos"); form.setValue(`items.${index}.rate`, sor.rate || 0); setActivePopoverIndex(null); setCurrentSearchTerm(''); }, [form]);
  
  if (authLoading && !userProfile) return <NewWorkOrderPageSkeleton />;
  if (!user || !userProfile || !dataOwnerId) { router.push('/auth/signin'); return <NewWorkOrderPageSkeleton />; }
  
  if (!canCreateWorkOrders) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"> <AlertTriangle className="w-16 h-16 text-destructive mb-4" /> <h2 className="text-xl font-semibold">Permission Denied</h2> <p className="text-muted-foreground">You do not have permission to create new work orders.</p> <Button asChild className="mt-4" onClick={() => setGlobalIsLoading(true)}> <Link href="/dashboard/work-orders">Back to Work Orders</Link> </Button> </div> );
  }
  
  const isLoadingForm = isLoadingDropdowns || isLoadingSorRates || isCreatingOrg;
  
  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <main className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center">
            <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Create New Work Order
          </h1>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/work-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Work Orders</Link>
          </Button>
        </div>
        
        {isLoadingDropdowns ? <NewWorkOrderPageSkeleton /> : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle>Work Order Details</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Your Company*</FormLabel><Combobox options={companies} value={field.value} onChange={(value) => field.onChange(value)} placeholder="Select company..."/></FormItem>)}/>
                <FormField control={form.control} name="organizationId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Client Organization*</FormLabel><Combobox options={organizations} value={field.value} onChange={(value) => field.onChange(value)} placeholder="Select client..."/><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="workOrderNumber" render={({field}) => (<FormItem><FormLabel>WO Number*</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{WORK_ORDER_STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g," ")}</SelectItem>))}</SelectContent></Select></FormItem>)}/>
                <FormField control={form.control} name="startDate" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>Start Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : "Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)}/>
                <FormField control={form.control} name="endDate" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>End Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : "Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)}/>
                <FormField control={form.control} name="securityDeposit" render={({field}) => (<FormItem><FormLabel>Security Deposit (₹)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                <FormField control={form.control} name="depositPeriod" render={({field}) => (<FormItem><FormLabel>Deposit Period (Months)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}/></FormControl></FormItem>)}/>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Items & Scope</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                 <FormField control={form.control} name="scopeOfWork" render={({ field }) => (<FormItem><FormLabel>Scope of Work</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
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
                 <Button type="button" onClick={() => append(DEFAULT_WO_ITEMS_FORM[0])}><PlusCircle className="mr-2 h-4 w-4"/>Add Item</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Summary & Terms</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6 items-start">
                  <FormField control={form.control} name="termsAndConditions" render={({field}) => (<FormItem><FormLabel>Terms & Conditions</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={8} /></FormControl></FormItem>)}/>
                  <Card className="p-4 bg-secondary/50">
                      <CardContent className="space-y-2 p-0">
                          <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subTotal)}</span></div>
                          <FormField control={form.control} name="taxRate" render={({field}) => (<FormItem className="flex justify-between items-center"><FormLabel>Tax Rate (%):</FormLabel><FormControl><Input type="number" className="w-24 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}/></FormControl></FormItem>)}/>
                          <div className="flex justify-between"><span>Tax Amount:</span><span>{formatCurrency(taxAmount)}</span></div>
                          <hr className="my-2 border-border" />
                          <div className="flex justify-between font-bold text-lg text-primary"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                      </CardContent>
                  </Card>
              </CardContent>
              <CardFooter><Button type="submit" disabled={isSubmittingForm || isLoadingForm || authLoading || !canCreateWorkOrders}>{isSubmittingForm || isLoadingForm ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating...</> : <><Save className="mr-2 h-4 w-4"/>Create WO</>}</Button></CardFooter>
            </Card>
          </form>
        </Form>
        )}
      </main>
    </>
  );
}

function NewWorkOrderPageWrapper() {
    return (
        <Suspense fallback={<NewWorkOrderPageSkeleton />}>
            <NewWorkOrderPageContent />
        </Suspense>
    );
}
export default NewWorkOrderPageWrapper;
