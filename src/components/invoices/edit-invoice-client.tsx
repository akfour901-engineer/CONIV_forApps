'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from "@/components/ui/button";
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
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Company, Organization, Invoice, InvoiceItem, InvoiceStatus, WorkOrder, SorRate } from '@/types';
import { INVOICE_STATUS_OPTIONS } from '@/types';
import { format, parseISO } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import { Edit, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, PlusCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import EditInvoicePageSkeleton from '@/app/dashboard/invoices/[id]/edit/loading';

const invoiceItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  rate: z.coerce.number().min(0, 'Rate must be at least 0'),
});

const invoiceUpdateSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required.").optional(),
  companyId: z.string().min(1, "Company ID is required.").optional(),
  organizationId: z.string().min(1, "Organization ID is required.").optional(),
  date: z.date({ required_error: "Invoice date is required." }).optional(),
  dueDate: z.date({ required_error: "Due date is required." }).optional(),
  status: z.enum(INVOICE_STATUS_OPTIONS).optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required.").optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentInstructions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  workOrderIdForLinking: z.string().optional().nullable(),
  workOrderNumber: z.string().optional().nullable(),
}).refine(data => !data.dueDate || !data.date || new Date(data.dueDate) >= new Date(data.date), {
  message: "Due date cannot be before invoice date.",
  path: ["dueDate"],
});

type InvoiceFormValues = z.infer<typeof invoiceUpdateSchema>;

export default function EditInvoicePageContent({ invoiceId }: { invoiceId: string }) {
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
  const [isLoadingSorRates, setIsLoadingSorRates] = useState(false);
  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const canEditInvoices = isViewingOwnAccount || !!currentTeamMemberPermissions?.canEditInvoices;

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceUpdateSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const fetchInitialData = useCallback(async () => {
    if (!dataOwnerId || !user || !canEditInvoices) {
      if (!authLoading && !canEditInvoices) {
        toast({ title: "Permission Denied", variant: "destructive" });
        router.push('/dashboard/invoices');
      }
      setIsLoadingPageData(false);
      return;
    }

    setIsLoadingPageData(true);
    try {
      const idToken = await user.getIdToken();
      const [companyResponse, orgResponse, woResponse, invoiceResponse, sorResponse] = await Promise.all([
        fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/organizations?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/invoices/${invoiceId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/sor-rates?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` }})
      ]);
      
      if (!companyResponse.ok) throw new Error('Failed to fetch companies');
      const companiesData: Company[] = await companyResponse.json();
      setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name, data: c })));

      if (!orgResponse.ok) throw new Error('Failed to fetch organizations');
      const orgsData: Organization[] = await orgResponse.json();
      setOrganizations(orgsData.map(o => ({ value: o.id!, label: o.name, data: o })));
      
      if (!woResponse.ok) throw new Error('Failed to fetch work orders');
      const wosData: WorkOrder[] = await woResponse.json();
      setWorkOrders(wosData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}`, data: wo })));
      
      if (!sorResponse.ok) throw new Error('Failed to fetch SOR rates');
      setAvailableSorItems(await sorResponse.json());

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json();
        throw new Error(errorData.error || `Failed to fetch invoice: ${invoiceResponse.status}`);
      }
      const data: Invoice = await invoiceResponse.json();
      setInvoice(data);

      form.reset({
        invoiceNumber: data.invoiceNumber,
        date: data.date ? parseISO(data.date) : new Date(),
        dueDate: data.dueDate ? parseISO(data.dueDate) : new Date(),
        companyId: data.companyId,
        organizationId: data.organizationId,
        items: data.items,
        taxRate: data.taxRate ?? 0,
        amountPaid: data.amountPaid ?? 0,
        paymentInstructions: data.paymentInstructions || "",
        notes: data.notes || "",
        status: data.status,
        workOrderIdForLinking: data.workOrderId || "",
        workOrderNumber: data.workOrderNumber || "",
      });

    } catch (e: any) { 
      console.error("Error fetching data for invoice edit:", e); 
      toast({title: "Error", description: e.message || "Could not load required data.", variant: "destructive"});
      router.push('/dashboard/invoices');
    } finally {
      setIsLoadingPageData(false);
    }
  }, [invoiceId, dataOwnerId, user, authLoading, toast, router, form, canEditInvoices]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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
    if (!dataOwnerId || !user || !invoiceId || !canEditInvoices) {
      toast({ title: "Error", variant: "destructive" });
      return;
    }
    
    setIsSubmittingForm(true);

    const invoiceDataToUpdate = {
      ...values,
      date: values.date ? format(values.date, 'yyyy-MM-dd') : undefined,
      dueDate: values.dueDate ? format(values.dueDate, 'yyyy-MM-dd') : undefined,
      paymentInstructions: values.paymentInstructions,
      notes: values.notes,
    };
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(invoiceDataToUpdate),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update invoice.');
      }
      toast({ title: "Success", description: "Invoice updated." });
      router.push('/dashboard/invoices');
    } catch (e: any) {
      console.error('Error updating invoice:', e);
      toast({
        title: 'Error Updating Invoice',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const filteredSorItems = useMemo(() => availableSorItems.filter(sor => (sor.itemDescription?.toLowerCase() || '').includes(activePopoverIndex !== null ? form.watch(`items.${activePopoverIndex}.description`, "").toLowerCase() : "")).slice(0, 5), [availableSorItems, activePopoverIndex, form]);
  const handleSorSelect = useCallback((index: number, sor: SorRate) => { 
    form.setValue(`items.${index}.itemCode`, sor.itemCode || ""); 
    form.setValue(`items.${index}.description`, sor.itemDescription || ""); 
    form.setValue(`items.${index}.unit`, sor.unit || "nos"); 
    form.setValue(`items.${index}.rate`, sor.rate || 0); 
    setActivePopoverIndex(null); 
    setCurrentSearchTerm(''); 
  }, [form]);
  
  if (isLoadingPageData || authLoading) return <EditInvoicePageSkeleton />;
  if (!invoice || !canEditInvoices)
    return (
      <div className="p-4 text-center">
        Invoice not found or access denied.{' '}
        <Link href="/dashboard/invoices" className="text-primary underline">
          Go back
        </Link>.
      </div>
    );

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/dashboard/invoices/${invoiceId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <Edit className="mr-3 h-7 w-7 text-primary" /> Edit Invoice
            </h1>
            <p className="text-muted-foreground">Modify invoice: {invoice?.invoiceNumber}</p>
          </div>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Your Company*</FormLabel>
                    <Combobox
                      options={companies}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select company..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Client Organization*</FormLabel>
                    <Combobox
                      options={organizations}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select client..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="invoiceNumber" render={({field}) => (<FormItem><FormLabel>Invoice Number*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVOICE_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s.replace("-", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : "Pick date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : "Pick date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(d) => (form.getValues('date') ? d < form.getValues('date')! : false)}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent>
              {fields.map((item, index) => (
                <div key={item.id} className="p-4 border rounded-md mb-4 space-y-2">
                  <div className="flex justify-between items-center"><h5 className="font-medium">Item #{index + 1}</h5><Button type="button" variant="ghost" size="icon" onClick={()=>remove(index)}><Trash2 className="h-4 w-4"/></Button></div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name={`items.${index}.description`} render={({field}) => (<FormItem><FormLabel>Description*</FormLabel><Input placeholder="Item description or search SOR..." {...field} value={field.value ?? ""} /><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`items.${index}.quantity`} render={({field}) => (<FormItem><FormLabel>Quantity*</FormLabel><Input type="number" placeholder="1" {...field}/><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name={`items.${index}.unit`} render={({field}) => (<FormItem><FormLabel>Unit*</FormLabel><Input placeholder="e.g., nos, kg" {...field}/><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name={`items.${index}.rate`} render={({field}) => (<FormItem><FormLabel>Rate (₹)*</FormLabel><Input type="number" placeholder="0.00" {...field}/><FormMessage /></FormItem>)}/>
                  </div>
                  <div className="text-right font-medium">Amount: {formatCurrency((form.watch(`items.${index}.quantity`)||0) * (form.watch(`items.${index}.rate`)||0) )}</div>
                </div>
              ))}
              <Button type="button" onClick={() => append({ description: "", quantity: 1, unit: "nos", rate: 0, itemCode: "" })}>Add Item</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Summary & Terms</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <FormField control={form.control} name="notes" render={({field}) => (<FormItem><FormLabel>Notes</FormLabel><Textarea {...field} value={field.value ?? ""} /><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="paymentInstructions" render={({field}) => (<FormItem><FormLabel>Payment Instructions</FormLabel><Textarea {...field} value={field.value ?? ""} rows={5} /><FormMessage /></FormItem>)}/>
              </div>
              <Card className="p-4 bg-secondary/50">
                <CardContent className="space-y-2 p-0">
                  <div className="flex justify-between"><span>Subtotal:</span><span className="font-medium">{formatCurrency(subTotal)}</span></div>
                  <FormField control={form.control} name="taxRate" render={({field}) => (<FormItem className="flex justify-between items-center"><FormLabel>Tax Rate (%):</FormLabel><Input type="number" className="w-24 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}/><FormMessage /></FormItem>)}/>
                  <div className="flex justify-between"><span>Tax Amount:</span><span className="font-medium">{formatCurrency(taxAmount)}</span></div>
                  <hr className="my-2 border-border" />
                  <div className="flex justify-between text-lg font-bold text-primary"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                  <FormField control={form.control} name="amountPaid" render={({field}) => (<FormItem className="flex justify-between items-center border-t pt-2 mt-2"><FormLabel>Amount Paid:</FormLabel><Input type="number" className="w-32 text-right" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}/><FormMessage /></FormItem>)}/>
                  <hr className="my-2 border-border" />
                  <div className="flex justify-between text-lg font-bold text-destructive"><span>Balance Due:</span><span>{formatCurrency(balanceDue)}</span></div>
                </CardContent>
              </Card>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={isSubmittingForm}
                className="w-full sm:w-auto ml-auto"
              >
                {isSubmittingForm ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Invoice
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </main>
  );
}