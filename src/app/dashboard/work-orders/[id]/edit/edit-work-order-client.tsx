'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Company, Organization, PurchaseOrder, PurchaseOrderItem, WorkOrder, SorRate, Estimate, AppConfiguration, AISuggestedEstimateItem } from '@/types/server-only';
import { WORK_ORDER_STATUS_OPTIONS } from '@/types';
import { Edit, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, PlusCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import EditWorkOrderPageSkeleton from './loading';
import { formatCurrency } from '@/lib/utils';
import { PO_COMMIT_TO_EXPENSE_COST, ORGANIZATION_CREATION_COST } from '@/lib/constants';

const workOrderItemSchema = z.object({ id: z.string().optional(), itemCode: z.string().optional().nullable(), description: z.string().min(1), quantity: z.coerce.number().min(0.01), unit: z.string().min(1), rate: z.coerce.number().min(0), amount: z.number() });
const workOrderUpdateSchema = z.object({
  workOrderNumber: z.string().min(1, "Work Order number is required.").optional(),
  companyId: z.string().min(1, "Company ID is required.").optional(),
  organizationId: z.string().min(1, "Organization ID is required.").optional(),
  startDate: z.date({ required_error: "Start date is required." }).optional(),
  endDate: z.date({ required_error: "End date is required." }).optional(),
  securityDeposit: z.coerce.number().optional().nullable(),
  depositPeriod: z.coerce.number().int().optional().nullable(),
  scopeOfWork: z.string().max(5000).optional().nullable(),
  status: z.enum(['draft', 'pending', 'approved', 'in-progress', 'completed', 'on-hold', 'cancelled']).optional(),
  items: z.array(workOrderItemSchema).min(1, "At least one item is required.").optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  estimateId: z.string().optional().nullable(),
  awardProofUrl: z.string().optional().nullable(),
}).refine(data => !data.endDate || !data.startDate || data.endDate >= data.startDate, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});


type WorkOrderFormValues = z.infer<typeof workOrderUpdateSchema>;

export default function EditWorkOrderPageContent({ id }: { id: string }) {
    const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount, appConfig } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
  
    const [isLoadingPageData, setIsLoadingPageData] = useState(true);
    const [isSubmittingForm, setIsSubmittingForm] = useState(false);
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
    
    const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
    const [isLoadingSorRates, setIsLoadingSorRates] = useState(false);
    const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
    const [currentSearchTerm, setCurrentSearchTerm] = useState('');
    
    const [isCreatingOrg, setIsCreatingOrg] = useState(false);
    
    const canEditWOs = isViewingOwnAccount || !!currentTeamMemberPermissions?.canEditWorkOrders;
  
    const form = useForm<WorkOrderFormValues>({
      resolver: zodResolver(workOrderUpdateSchema),
    });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  
    useEffect(() => {
      if (!dataOwnerId || !user || authLoading) return;
      
      const fetchInitialData = async () => {
        if (!canEditWOs) { setIsLoadingPageData(false); return; }
        setIsLoadingPageData(true);
        try {
          const idToken = await user.getIdToken();
          const [companyResponse, orgResponse, woResponse, sorResponse] = await Promise.all([
            fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
            fetch(`/api/organizations?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
            fetch(`/api/work-orders/${id}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
            fetch(`/api/sor-rates?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}`}})
          ]);
          
          if (!companyResponse.ok) throw new Error('Failed to fetch companies');
          const companiesData: Company[] = await companyResponse.json();
          setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name, data: c })));
  
          if (!orgResponse.ok) throw new Error('Failed to fetch organizations');
          const orgsData: Organization[] = await orgResponse.json();
          setOrganizations(orgsData.map(o => ({ value: o.id!, label: o.name, data: o })));
  
          if (!sorResponse.ok) throw new Error('Failed to fetch SOR rates');
          setAvailableSorItems(await sorResponse.json());
          
          if (!woResponse.ok) {
              const errorData = await woResponse.json();
              throw new Error(errorData.error || `Failed to fetch WO: ${woResponse.status}`);
          }
          const data: WorkOrder = await woResponse.json();
          
          setWorkOrder(data);
          form.reset({
            workOrderNumber: data.workOrderNumber, 
            startDate: data.startDate ? parseISO(data.startDate) : new Date(),
            endDate: data.endDate ? parseISO(data.endDate) : new Date(),
            companyId: data.companyId, 
            organizationId: data.organizationId,
            items: data.items.map(item => ({ ...item, id: Math.random().toString() })),
            taxRate: data.taxRate ?? 0,
            scopeOfWork: data.scopeOfWork || "", 
            termsAndConditions: data.termsAndConditions || "",
            status: data.status,
            securityDeposit: data.securityDeposit,
            depositPeriod: data.depositPeriod,
            estimateId: data.estimateId,
            awardProofUrl: data.awardProofUrl,
          });
  
        } catch (e: any) { 
          console.error("Error fetching data for WO edit:", e); 
          toast({title: "Error", description: e.message || "Could not load required data.", variant: "destructive"});
          router.push("/dashboard/work-orders");
        }
        setIsLoadingPageData(false);
      };
      fetchInitialData();
    }, [id, dataOwnerId, user, authLoading, toast, router, form, canEditWOs]);
  
     const handleCreateOrganization = async (orgName: string) => {
      if (!user || !dataOwnerId || !userProfile || !appConfig) return;
      
      const cost = appConfig?.actionCosts?.find(c => c.key === 'ORGANIZATION_CREATION_COST')?.cost ?? ORGANIZATION_CREATION_COST;
      const currentPoints = userProfile.resourcePoints ?? 0;
      if (currentPoints < cost) {
          toast({title: "Insufficient Points", description: `You need ${cost} points to create an organization.`, variant: "destructive"});
          return;
      }

      setIsCreatingOrg(true);
      try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/organizations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
              body: JSON.stringify({ name: orgName, visibility: 'private' }),
          });
          if (!response.ok) throw new Error((await response.json()).error || "Failed to create organization.");
          
          const newOrg: Organization = await response.json();
          toast({ title: "Organization Created", description: `${newOrg.name} has been added.`});
          
          const newOption: ComboboxOption = { value: newOrg.id!, label: newOrg.name, data: newOrg };
          setOrganizations(prev => [...prev, newOption].sort((a,b) => a.label.localeCompare(b.label)));
          form.setValue('organizationId', newOrg.id!);

      } catch (error: any) {
          toast({ title: "Error", description: `Could not create organization: ${error.message}`, variant: "destructive"});
      } finally {
          setIsCreatingOrg(false);
      }
    };

    const calculateTotals = () => {
      const items = form.getValues("items") || [];
      const taxRate = form.getValues("taxRate") || 0;
      const subTotalCalc = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const taxAmountCalc = (subTotalCalc * taxRate) / 100;
      const grandTotalCalc = subTotalCalc + taxAmountCalc;
      return { subTotal: subTotalCalc, taxAmount: taxAmountCalc, grandTotal: grandTotalCalc };
    };
    form.watch(["items", "taxRate"]); // Trigger re-calculation
    const { subTotal, taxAmount, grandTotal } = calculateTotals();
  
    const onSubmit = async (values: WorkOrderFormValues) => {
      if (!dataOwnerId || !user || !userProfile || !id || !canEditWOs) { 
        toast({title: "Error", variant: "destructive"}); 
        return; 
      }
  
      setIsSubmittingForm(true);
      const woDataToUpdate = {
        ...values,
        startDate: values.startDate ? format(values.startDate, 'yyyy-MM-dd') : undefined,
        endDate: values.endDate ? format(values.endDate, 'yyyy-MM-dd') : undefined,
        scopeOfWork: values.scopeOfWork || null,
        termsAndConditions: values.termsAndConditions || null,
        securityDeposit: values.securityDeposit ?? null,
        depositPeriod: values.depositPeriod ?? null,
        estimateId: values.estimateId || null,
        awardProofUrl: values.awardProofUrl || null,
      };
  
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/work-orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify(woDataToUpdate),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update WO.');
        }
        toast({ title: "Success", description: "Work Order updated." });
        router.push("/dashboard/work-orders");
      } catch (e: any) { 
        console.error("Error updating WO:", e); 
        toast({title:"Error Updating Work Order", description: e.message, variant: "destructive"});
      } finally {
        setIsSubmittingForm(false);
      }
    };
  
    const filteredSorItems = availableSorItems.filter(sor => (sor.itemDescription?.toLowerCase() || '').includes(activePopoverIndex !== null ? form.watch(`items.${activePopoverIndex}.description`, "").toLowerCase() : "")).slice(0, 5);
  
    const handleSorSelect = useCallback((index: number, sor: SorRate) => { form.setValue(`items.${index}.itemCode`, sor.itemCode || null); form.setValue(`items.${index}.description`, sor.itemDescription || ""); form.setValue(`items.${index}.unit`, sor.unit || "nos"); form.setValue(`items.${index}.rate`, sor.rate || 0); setActivePopoverIndex(null); setCurrentSearchTerm(''); }, [form]);
  
    if (isLoadingPageData || authLoading) return <EditWorkOrderPageSkeleton />;
    if (!canEditWOs) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Permission Denied</h2>
          <p className="text-muted-foreground">You do not have permission to edit Work Orders.</p>
          <Button asChild className="mt-4"><Link href="/dashboard/work-orders">Back to Work Orders</Link></Button>
        </div>
      );
    }
    if (!workOrder) return <div className="p-4 text-center">Work Order not found. <Link href="/dashboard/work-orders" className="text-primary underline">Go back</Link>.</div>;
  
  
    return (
      <main className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" asChild>
                  <Link href={`/dashboard/work-orders/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div>
                  <h1 className="text-2xl font-semibold flex items-center">
                      <Edit className="mr-3 h-7 w-7 text-primary" /> Edit Work Order
                  </h1>
                  <p className="text-muted-foreground">Modify WO: {workOrder?.workOrderNumber}</p>
              </div>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Work Order Details</CardTitle>
                <CardDescription>Update general information for this Work Order.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="workOrderNumber" render={({field}) => (<FormItem><FormLabel>Work Order Number*</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="companyId" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>Issuing Company*</FormLabel><Combobox options={companies} value={field.value} onChange={field.onChange} placeholder="Select company..." searchPlaceholder="Search companies..." disabled={isLoadingPageData || companies.length === 0} emptyResultText={isLoadingPageData? "Loading..." : "No companies found."} /><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="organizationId" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>Client*</FormLabel><Combobox options={organizations} value={field.value} onChange={field.onChange} placeholder="Select client..." searchPlaceholder="Search clients..." disabled={isLoadingPageData || organizations.length === 0} emptyResultText={isLoadingPageData? "Loading..." : "No clients found."} /><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="startDate" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>Start Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value,"PPP") : "Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent></Popover><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="endDate" render={({field}) => (<FormItem className="flex flex-col"><FormLabel>End Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value,"PPP") : "Pick date"}</Button></FormControl></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => form.getValues('startDate') ? d < form.getValues('startDate')! : false} initialFocus/></PopoverContent></Popover><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="status" render={({field}) => (<FormItem><FormLabel>Status*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Status"/></SelectTrigger></FormControl><SelectContent>{WORK_ORDER_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g," ")}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="securityDeposit" render={({field}) => (<FormItem><FormLabel>Security Deposit (₹)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="depositPeriod" render={({field}) => (<FormItem><FormLabel>Deposit Period (Months)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="scopeOfWork" render={({field}) => (<FormItem className="md:col-span-2"><FormLabel>Scope of Work</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl><FormMessage/></FormItem>)}/>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Work Order Items</CardTitle>
                <CardDescription>Modify items to be executed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((item, index) => (
                  <div key={item.id || `item-${index}`} className="p-4 border rounded-md space-y-2 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Item #{index+1}</h4>
                      {fields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={()=>remove(index)}><Trash2 className="h-4 w-4"/></Button>}
                    </div>
                    <FormField control={form.control} name={`items.${index}.itemCode`} render={({field}) => (<FormItem><FormLabel>Item Code (Optional)</FormLabel><FormControl><Input placeholder="e.g., MAT-001" {...field} value={field.value ?? ""}/></FormControl><FormMessage/></FormItem>)}/>
                    <Controller control={form.control} name={`items.${index}.description`} render={({field}) => (<FormItem><FormLabel>Description*</FormLabel><Popover open={activePopoverIndex === index} onOpenChange={(open) => { setActivePopoverIndex(open ? index : null); if (!open) setCurrentSearchTerm(''); }}><PopoverTrigger asChild><FormControl><Input placeholder="Item description or search SOR..." {...field} value={field.value ?? ""} onChange={(e) => { field.onChange(e); setCurrentSearchTerm(e.target.value); if (activePopoverIndex !== index) setActivePopoverIndex(index); }} onFocus={() => { setActivePopoverIndex(index); setCurrentSearchTerm(field.value ?? ''); }} /></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search SOR..." value={currentSearchTerm} onValueChange={(search) => setCurrentSearchTerm(search)} /><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup>{filteredSorItems.map((sor) => (<CommandItem key={sor.id} value={`${sor.itemCode} - ${sor.itemDescription}`} onSelect={() => { form.setValue(`items.${index}.itemCode`, sor.itemCode || null); form.setValue(`items.${index}.description`, sor.itemDescription); form.setValue(`items.${index}.unit`, sor.unit); form.setValue(`items.${index}.rate`, sor.rate); setActivePopoverIndex(null); setCurrentSearchTerm(''); }}>
                                        <div className="flex flex-col"> <span className="font-medium">{sor.itemDescription}</span> <span className="text-xs text-muted-foreground"> Code: {sor.itemCode} | Unit: {sor.unit} | Rate: {formatCurrency(sor.rate)} </span> </div>
                                      </CommandItem>
                                    ))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormDescription>If not available please create at sor rates first.</FormDescription><FormMessage /></FormItem>)} />
                    <div className="grid sm:grid-cols-3 gap-4">
                      <FormField control={form.control} name={`items.${index}.quantity`} render={({field}) => (<FormItem><FormLabel>Quantity*</FormLabel><FormControl><Input type="number" placeholder="1" {...field}/></FormControl></FormItem>)}/>
                      <FormField control={form.control} name={`items.${index}.unit`} render={({field}) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input placeholder="e.g., nos, kg" {...field}/></FormControl></FormItem>)}/>
                      <FormField control={form.control} name={`items.${index}.rate`} render={({field}) => (<FormItem><FormLabel>Rate (₹)*</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field}/></FormControl></FormItem>)}/>
                    </div>
                    <div className="text-right font-medium">Amount: {formatCurrency((form.watch(`items.${index}.quantity`)||0) * (form.watch(`items.${index}.rate`)||0) )}</div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={()=>append({ itemCode: "", description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 })}>
                  <PlusCircle className="mr-2 h-4 w-4"/>Add Item
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Terms & Summary</CardTitle>
                <CardDescription>Update terms and notes.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6 items-start">
                <FormField control={form.control} name="termsAndConditions" render={({field}) => (<FormItem><FormLabel>Terms & Conditions</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={8} /></FormControl><FormMessage/></FormItem>)}/>
                <Card className="p-4 bg-secondary/50">
                    <CardContent className="space-y-2 p-0">
                        <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subTotal)}</span></div>
                        <FormField control={form.control} name="taxRate" render={({field}) => (<FormItem className="flex justify-between items-center"><FormLabel>Tax Rate (%):</FormLabel><FormControl><Input type="number" className="w-24 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem>)}/>
                        <div className="flex justify-between"><span>Tax Amount:</span><span>{formatCurrency(taxAmount)}</span></div>
                        <hr/>
                        <div className="flex justify-between font-bold text-lg text-primary"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                    </CardContent>
                </Card>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmittingForm || isLoadingPageData || authLoading || !canEditWOs} className="w-full sm:w-auto ml-auto">
                  {isSubmittingForm || isLoadingPageData ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Updating...</> : <><Save className="mr-2 h-4 w-4"/>Update Work Order</>}
                </Button>
              </CardFooter>
             </Card>
          </form>
        </Form>
      </main>
    )
  }