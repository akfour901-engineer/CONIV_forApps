
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
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, PurchaseOrderItem, UserProfile, Company, Organization, TeamMember, WorkOrder, Subcontractor, SorRate } from '@/types/server-only';
import { PURCHASE_ORDER_STATUS_OPTIONS } from '@/types/index';
import { Edit, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import EditPurchaseOrderPageSkeleton from './loading';

const purchaseOrderItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required."),
  type: z.enum(['material', 'service']),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().min(1, "Unit is required."),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
  amount: z.coerce.number().min(0),
});

const purchaseOrderUpdateSchema = z.object({
  poNumber: z.string().min(1, "PO number is required.").optional(),
  date: z.date({ required_error: "PO date is required." }).optional(),
  companyId: z.string().min(1, "Company is required.").optional(),
  supplierType: z.enum(['organization', 'subcontractor']).optional(),
  supplierOrganizationId: z.string().optional().nullable(),
  supplierSubcontractorId: z.string().optional().nullable(),
  workOrderId: z.string().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required.").optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  shippingAddress: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  paymentTerms: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(PURCHASE_ORDER_STATUS_OPTIONS).optional(),
}).refine(data => data.supplierType !== 'organization' || !!data.supplierOrganizationId, {
    message: "Supplier organization is required.",
    path: ["supplierOrganizationId"],
}).refine(data => data.supplierType !== 'subcontractor' || !!data.supplierSubcontractorId, {
    message: "Supplier subcontractor is required.",
    path: ["supplierSubcontractorId"],
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderUpdateSchema>;

interface EditPurchaseOrderClientProps {
  poId: string;
}

export default function EditPurchaseOrderClient({ poId }: EditPurchaseOrderClientProps) {
    const { user, dataOwnerId, isViewingOwnAccount, currentTeamMemberPermissions, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
    const [subcontractors, setSubcontractors] = useState<ComboboxOption[]>([]);
    const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
    const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
    const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
    const [currentSearchTerm, setCurrentSearchTerm] = useState('');

    const canEdit = isViewingOwnAccount || !!currentTeamMemberPermissions?.canEditPurchaseOrders;

    const form = useForm<PurchaseOrderFormValues>({
        resolver: zodResolver(purchaseOrderUpdateSchema),
    });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    const supplierType = form.watch("supplierType");
    const selectedCompanyId = form.watch("companyId");
    
    const fetchFormData = useCallback(async () => {
        if (!user || !dataOwnerId) return;
        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const [poRes, formDataRes] = await Promise.all([
                fetch(`/api/purchase-orders/${poId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                fetch(`/api/purchase-orders/form-data?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
            ]);
            
            if (!poRes.ok) throw new Error((await poRes.json()).error || 'Failed to fetch PO.');
            const poData: PurchaseOrder = await poRes.json();
            setPurchaseOrder(poData);
            
            if (!formDataRes.ok) throw new Error((await formDataRes.json()).error || 'Failed to fetch form data.');
            const formData = await formDataRes.json();
            setCompanies(formData.companies.map((c: Company) => ({ value: c.id!, label: c.name })));
            setOrganizations(formData.organizations.map((o: Organization) => ({ value: o.id!, label: o.name })));
            setSubcontractors(formData.subcontractors.map((s: Subcontractor) => ({ value: s.id!, label: s.name })));
            setAvailableSorItems(formData.sorRates);

            form.reset({
                ...poData,
                date: poData.date ? parseISO(poData.date) : new Date(),
                taxRate: poData.taxRate ?? 0,
            });

        } catch (e: any) {
            toast({ title: "Error", description: `Could not load data: ${e.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, dataOwnerId, poId, toast, form]);

    useEffect(() => {
        if (!authLoading && canEdit) {
            fetchFormData();
        } else if (!authLoading && !canEdit) {
             toast({ title: "Permission Denied", variant: "destructive" });
             router.push('/dashboard/advance-tools/purchase-orders');
        }
    }, [authLoading, canEdit, fetchFormData, router, toast]);

    const onSubmit = async (values: PurchaseOrderFormValues) => {
        if (!user || !poId) return;
        setIsSubmitting(true);
        try {
            const idToken = await user.getIdToken();
            const dataToUpdate = {
                ...values,
                date: values.date ? format(values.date, 'yyyy-MM-dd') : undefined,
                taxRate: values.taxRate ?? undefined,
            };
            const response = await fetch(`/api/purchase-orders/${poId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(dataToUpdate),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to update PO.');
            toast({ title: "Success", description: "Purchase Order updated." });
            router.push('/dashboard/advance-tools/purchase-orders');
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const calculateTotals = () => {
        const items = form.getValues("items") || [];
        const taxRate = form.getValues("taxRate") || 0;
        const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const taxAmount = (subTotal * taxRate) / 100;
        return { subTotal, taxAmount, grandTotal: subTotal + taxAmount };
    };
    form.watch(["items", "taxRate"]);
    const { subTotal, taxAmount, grandTotal } = calculateTotals();
    
    const filteredSorItems = useMemo(() =>
        availableSorItems.filter(sor =>
            (sor.itemDescription?.toLowerCase() || '').includes(currentSearchTerm.toLowerCase()) ||
            (sor.itemCode?.toLowerCase() || '').includes(currentSearchTerm.toLowerCase())
        ).slice(0, 5),
    [availableSorItems, currentSearchTerm]);
    
    const handleSorSelect = (index: number, sor: SorRate) => {
        form.setValue(`items.${index}.itemCode`, sor.itemCode || "");
        form.setValue(`items.${index}.description`, sor.itemDescription || "");
        form.setValue(`items.${index}.unit`, sor.unit || "nos");
        form.setValue(`items.${index}.rate`, sor.rate || 0);
        setActivePopoverIndex(null);
    };

    const handleAddItem = () => {
        const newItem = { description: '', quantity: 1, unit: 'nos', rate: 0, type: "material" as const, amount: 0 };
        append(newItem);
    };


    if (isLoading || authLoading) return <EditPurchaseOrderPageSkeleton />;
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><Edit className="mr-3 h-7 w-7 text-primary" /> Edit Purchase Order</h1>
                    <p className="text-muted-foreground">Modifying PO: {purchaseOrder?.poNumber}</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools/purchase-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back to POs</Link></Button>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>PO Details</CardTitle></CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="companyId" render={({field}) => (<FormItem><FormLabel>Your Company*</FormLabel><Combobox options={companies} {...field} placeholder="Select your company..." searchPlaceholder="Search..."/></FormItem>)}/>
                            <FormField control={form.control} name="poNumber" render={({field}) => (<FormItem><FormLabel>PO Number*</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                            <FormField control={form.control} name="date" render={({field}) => (<FormItem><FormLabel>Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)} />
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
                                    <Controller control={form.control} name={`items.${index}.description`} render={({field}) => (<FormItem><FormLabel>Description*</FormLabel><Popover open={activePopoverIndex === index} onOpenChange={(open) => setActivePopoverIndex(open ? index : null)}><PopoverTrigger asChild><FormControl><Input placeholder="Item description or search SOR..." {...field} /></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search SOR..." onValueChange={setCurrentSearchTerm}/><CommandList><CommandEmpty>No results.</CommandEmpty><CommandGroup>{filteredSorItems.map((sor: SorRate) => (<CommandItem key={sor.id} value={sor.itemDescription} onSelect={() => handleSorSelect(index, sor)}>{sor.itemDescription}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage/></FormItem>)}/>
                                    <div className="grid sm:grid-cols-3 gap-4">
                                        <FormField control={form.control} name={`items.${index}.quantity`} render={({field}) => (<FormItem><FormLabel>Quantity*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                                        <FormField control={form.control} name={`items.${index}.unit`} render={({field}) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>)}/>
                                        <FormField control={form.control} name={`items.${index}.rate`} render={({field}) => (<FormItem><FormLabel>Rate (₹)*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                                    </div>
                                    <div className="text-right font-medium">Amount: {formatCurrency((form.watch(`items.${index}.quantity`)||0) * (form.watch(`items.${index}.rate`)||0))}</div>
                                </div>
                            ))}
                            <Button type="button" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4"/>Add Item</Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Shipping, Payment & Summary</CardTitle></CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-6 items-start">
                            <FormField control={form.control} name="shippingAddress" render={({field}) => (<FormItem><FormLabel>Shipping Address</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                            <FormField control={form.control} name="billingAddress" render={({field}) => (<FormItem><FormLabel>Billing Address</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                            <FormField control={form.control} name="paymentTerms" render={({field}) => (<FormItem><FormLabel>Payment Terms</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                            <FormField control={form.control} name="notes" render={({field}) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl></FormItem>)}/>
                            <FormField control={form.control} name="taxRate" render={({field}) => (<FormItem><FormLabel>Tax Rate (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl></FormItem>)}/>
                            <div>
                                <h4 className="font-semibold mb-2">Summary</h4>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subTotal)}</span></div>
                                    <div className="flex justify-between"><span>Tax:</span><span>{formatCurrency(taxAmount)}</span></div>
                                    <div className="flex justify-between font-bold"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Updating...</> : <><Save className="mr-2 h-4 w-4"/>Update PO</>}</Button></CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
}

