'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Company, Organization, WorkOrder, SorRate, AppConfiguration, Subcontractor, PurchaseOrderItem, PurchaseOrder } from '@/types/server-only';
import { PURCHASE_ORDER_CREATION_COST } from '@/lib/constants';
import { ShoppingCart, PlusCircle, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import NewPurchaseOrderPageSkeleton from '@/app/dashboard/advance-tools/purchase-orders/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { useLoading } from '@/contexts/loading-context';

const purchaseOrderItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required.").default(""),
  type: z.enum(['material', 'service']).default('material'),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0.").default(1),
  unit: z.string().min(1, "Unit is required.").default("nos"),
  rate: z.coerce.number().min(0, "Rate must be non-negative.").default(0),
  amount: z.number(),
});

const purchaseOrderFormSchema = z.object({
  poNumber: z.string().min(1, "PO number is required.").max(100),
  date: z.date({ required_error: "PO date is required." }),
  companyId: z.string().min(1, "Issuing company is required."),
  supplierType: z.enum(['organization', 'subcontractor']).default('organization'),
  supplierOrganizationId: z.string().optional().nullable(),
  supplierSubcontractorId: z.string().optional().nullable(),
  workOrderId: z.string().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required."),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  shippingAddress: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  paymentTerms: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'billed', 'cancelled']).default('draft'),
}).refine(data => data.supplierType === 'organization' ? !!data.supplierOrganizationId : !!data.supplierSubcontractorId, {
    message: "A supplier must be selected based on the supplier type.",
    path: ["supplierOrganizationId"], 
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

const DEFAULT_PO_ITEMS_FORM = [{ itemCode: "", description: "", type: 'material' as const, quantity: 1, unit: "nos", rate: 0, id: 'default-0', amount: 0 }];

function NewPurchaseOrderPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  const [subcontractors, setSubcontractors] = useState<ComboboxOption[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canCreatePOs = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreatePurchaseOrders;

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      poNumber: `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000) + 1).padStart(4, '0')}`,
      date: new Date(),
      items: DEFAULT_PO_ITEMS_FORM,
      taxRate: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  const selectedCompanyId = form.watch("companyId");
  const supplierType = form.watch("supplierType");

  useEffect(() => {
    if (!authLoading && dataOwnerId && canCreatePOs) {
      const fetchPrerequisites = async () => {
        setIsLoading(true);
        try {
          const idToken = await user!.getIdToken();
          const response = await fetch(`/api/purchase-orders/form-data?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
          if (!response.ok) throw new Error('Failed to fetch form data.');
          const data = await response.json();
          setCompanies(data.companies.map((c: Company) => ({ value: c.id!, label: c.name })));
          setOrganizations(data.organizations.map((o: Organization) => ({ value: o.id!, label: o.name })));
          setSubcontractors(data.subcontractors.map((s: Subcontractor) => ({ value: s.id!, label: s.name })));
          setAvailableSorItems(data.sorRates);

          const woIdFromParams = searchParams?.get('workOrderId');
          const supplierTypeParam = searchParams?.get('supplierType');
          const supplierIdParam = searchParams?.get('supplierId');
          const templatePoId = searchParams?.get('templatePurchaseOrderId');

          if(templatePoId) {
             const templateResponse = await fetch(`/api/purchase-orders/${templatePoId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
             if(templateResponse.ok) {
                 const templateData: PurchaseOrder = await templateResponse.json();
                 form.reset({
                     ...form.getValues(),
                     companyId: templateData.companyId,
                     supplierType: templateData.supplierType,
                     supplierOrganizationId: templateData.supplierOrganizationId,
                     supplierSubcontractorId: templateData.supplierSubcontractorId,
                     workOrderId: templateData.workOrderId,
                     items: templateData.items.map(item => ({...item, id: undefined, amount: item.rate * item.quantity})),
                     taxRate: templateData.taxRate ?? 0,
                     shippingAddress: templateData.shippingAddress,
                     billingAddress: templateData.billingAddress,
                     paymentTerms: templateData.paymentTerms,
                     notes: templateData.notes,
                 });
                 toast({ title: "Template Loaded", description: "PO details pre-filled." });
                 return; // Prevent other logic from overwriting template data
             }
          }

          if (woIdFromParams) form.setValue('workOrderId', woIdFromParams);
           if (supplierTypeParam && supplierIdParam) {
               form.setValue('supplierType', supplierTypeParam as 'organization' | 'subcontractor');
               if (supplierTypeParam === 'organization') form.setValue('supplierOrganizationId', supplierIdParam);
               if (supplierTypeParam === 'subcontractor') form.setValue('supplierSubcontractorId', supplierIdParam);
           }
          
        } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchPrerequisites();
    }
  }, [user, dataOwnerId, canCreatePOs, toast, searchParams, form]);

  useEffect(() => {
    if (user && dataOwnerId && selectedCompanyId) {
      const fetchWOsForCompany = async () => {
        const idToken = await user.getIdToken();
        const url = selectedCompanyId 
            ? `/api/work-orders?dataOwnerId=${dataOwnerId}&companyId=${selectedCompanyId}`
            : `/api/work-orders?dataOwnerId=${dataOwnerId}`;
            
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${idToken}` } });
        if (response.ok) {
          const woData: WorkOrder[] = await response.json();
          setWorkOrders(woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));
        } else {
            setWorkOrders([]);
        }
      };
      fetchWOsForCompany();
    }
  }, [selectedCompanyId, user, dataOwnerId]);

  const onSubmit = async (values: PurchaseOrderFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) return;

    const cost = appConfig?.actionCosts?.find(c => c.key === 'PURCHASE_ORDER_CREATION_COST')?.cost ?? PURCHASE_ORDER_CREATION_COST;
    if ((userProfile.resourcePoints ?? 0) < cost) {
      setPointsInfo({ required: cost, current: userProfile.resourcePoints ?? 0 });
      setIsPointsDialogOpen(true);
      return;
    }
    
    setIsSubmittingForm(true);
    const poDataForApi = {
      ...values,
      date: format(values.date, 'yyyy-MM-dd'),
      dataOwnerId,
    };
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(poDataForApi),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create PO.');

      if (updateGlobalUserProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }});
      }

      toast({ title: "Success", description: "Purchase Order created successfully." });
      router.push('/dashboard/advance-tools/purchase-orders');
    } catch (error: any) {
      toast({ title: "Error Creating PO", description: error.message, variant: "destructive" });
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
  
  if (isLoading || authLoading) return <NewPurchaseOrderPageSkeleton />;
  if (!canCreatePOs) return <div className="p-4"><AlertTriangle className="inline-block mr-2" />Permission Denied.</div>;

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center"><PlusCircle className="mr-3 h-7 w-7 text-primary" /> New Purchase Order</h1>
          <Button variant="outline" asChild><Link href="/dashboard/advance-tools/purchase-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back to POs</Link></Button>
        </div>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader><CardTitle>PO Details</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem><FormLabel>Your Company*</FormLabel><Combobox options={companies} {...field} placeholder="Select your company..." searchPlaceholder="Search..."/></FormItem>)}/>
                  <FormField control={form.control} name="poNumber" render={({ field }) => (<FormItem><FormLabel>PO Number*</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                  <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)} />
                  <FormField control={form.control} name="workOrderId" render={({ field }) => (<FormItem><FormLabel>Link to Work Order</FormLabel><Combobox options={workOrders} {...field} placeholder="Select WO..." searchPlaceholder="Search..." disabled={!selectedCompanyId} emptyResultText="No WOs for this company."/></FormItem>)}/>
                </CardContent>
              </Card>
              <Card>
                 <CardHeader><CardTitle>Supplier Details</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                    <FormField control={form.control} name="supplierType" render={({ field }) => (<FormItem><FormLabel>Supplier Type*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="organization">Client/Organization</SelectItem><SelectItem value="subcontractor">Subcontractor</SelectItem></SelectContent></Select></FormItem>)} />
                    {supplierType === 'organization' && (<FormField control={form.control} name="supplierOrganizationId" render={({ field }) => (<FormItem><FormLabel>Supplier Organization*</FormLabel><Combobox options={organizations} {...field} placeholder="Select organization..." searchPlaceholder="Search..."/><FormMessage/></FormItem>)}/>)}
                    {supplierType === 'subcontractor' && (<FormField control={form.control} name="supplierSubcontractorId" render={({ field }) => (<FormItem><FormLabel>Supplier Subcontractor*</FormLabel><Combobox options={subcontractors} {...field} placeholder="Select subcontractor..." searchPlaceholder="Search..."/><FormMessage/></FormItem>)}/>)}
                 </CardContent>
              </Card>
              <Card>
                  <CardHeader><CardTitle>Items</CardTitle></CardHeader>
                  <CardContent>
                    {fields.map((item, index) => (
                      <div key={item.id} className="p-4 border rounded-md mb-4 space-y-2 relative">
                        <div className="flex justify-between items-center"><h5 className="font-medium">Item #{index + 1}</h5><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button></div>
                        <FormField control={form.control} name={`items.${index}.type`} render={({field}) => (<FormItem><FormLabel>Item Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="material">Material</SelectItem><SelectItem value="service">Service</SelectItem></SelectContent></Select></FormItem>)}/>
                        <Controller control={form.control} name={`items.${index}.description`} render={({field}) => (<FormItem><FormLabel>Description*</FormLabel><Popover open={activePopoverIndex === index} onOpenChange={(open) => setActivePopoverIndex(open ? index : null)}><PopoverTrigger asChild><FormControl><Input placeholder="Item description or search SOR..." {...field} value={field.value ?? ""} /></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search SOR..." onValueChange={setCurrentSearchTerm}/><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup>{filteredSorItems.map((sor) => (<CommandItem key={sor.id} value={sor.itemDescription} onSelect={() => handleSorSelect(index, sor)}>{sor.itemDescription}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        <div className="grid sm:grid-cols-3 gap-4">
                           <FormField control={form.control} name={`items.${index}.quantity`} render={({field}) => (<FormItem><FormLabel>Quantity*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                           <FormField control={form.control} name={`items.${index}.unit`} render={({field}) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>)}/>
                           <FormField control={form.control} name={`items.${index}.rate`} render={({field}) => (<FormItem><FormLabel>Rate (₹)*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                        </div>
                        <div className="text-right font-medium">Amount: {formatCurrency((form.watch(`items.${index}.quantity`)||0) * (form.watch(`items.${index}.rate`)||0))}</div>
                      </div>
                    ))}
                    <Button type="button" onClick={() => append(DEFAULT_PO_ITEMS_FORM[0])}><PlusCircle className="mr-2 h-4 w-4"/>Add Item</Button>
                  </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Shipping & Payment</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="shippingAddress" render={({field}) => (<FormItem><FormLabel>Shipping Address</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                    <FormField control={form.control} name="billingAddress" render={({field}) => (<FormItem><FormLabel>Billing Address</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                    <FormField control={form.control} name="paymentTerms" render={({field}) => (<FormItem><FormLabel>Payment Terms</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                    <FormField control={form.control} name="notes" render={({field}) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                    <FormField control={form.control} name="taxRate" render={({field}) => (<FormItem><FormLabel>Tax Rate (%)</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                    <div>
                        <h4 className="font-semibold mb-2">Summary</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subTotal)}</span></div>
                            <div className="flex justify-between"><span>Tax:</span><span>{formatCurrency(taxAmount)}</span></div>
                            <div className="flex justify-between font-bold"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter><Button type="submit" disabled={isSubmittingForm}>{isSubmittingForm ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating...</> : <><Save className="mr-2 h-4 w-4"/>Create PO</>}</Button></CardFooter>
              </Card>
            </form>
        </Form>
      </div>
    </>
  );
}

function NewPurchaseOrderPageWrapper() {
    return (
        <Suspense fallback={<NewPurchaseOrderPageSkeleton />}>
            <NewPurchaseOrderPageContent />
        </Suspense>
    )
}
export default NewPurchaseOrderPageWrapper;
