'use client';

import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
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
  FormDescription
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
import type { Company, Organization, Estimate, EstimateItem, SorRate, AppConfiguration, WorkOrder } from '@/types';  // ← changed to @/types
import { ESTIMATE_CREATION_COST, ORGANIZATION_CREATION_COST } from '@/lib/constants';
import { ESTIMATE_STATUS_OPTIONS } from '@/types';  // ← now from @/types (safe)
import { FileText, PlusCircle, Save, Trash2, CalendarIcon, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, addDays } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import NewEstimateLoading from './loading';
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

const estimateFormSchema = z.object({
  estimateNumber: z.string().min(1, "Estimate number is required."),
  subjectOfWork: z.string().max(500).optional().nullable(),
  date: z.date({ required_error: "Estimate date is required." }),
  validUntil: z.date().optional().nullable(),
  companyId: z.string().min(1, "Your company is required."),
  organizationId: z.string().min(1, "Client organization is required."),
  status: z.enum(ESTIMATE_STATUS_OPTIONS, { required_error: "Status is required." }).default('draft'),
  items: z.array(estimateItemSchema).min(1, "At least one item is required."),
  discount: z.coerce.number().min(0, "Discount must be non-negative.").optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  termsAndConditions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  workOrderIdForLinking: z.string().optional().nullable(),
}).refine(data => !data.validUntil || !data.date || data.validUntil >= data.date, {
  message: "Valid until date cannot be before estimate date.",
  path: ["validUntil"],
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;
const DEFAULT_ESTIMATE_ITEMS_FORM = [{ itemCode: "", description: "", quantity: 1, unit: "nos", rate: 0, id: 'default-0', amount: 0 }];

function NewEstimatePageContent() {
  const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
  const [isLoadingSorRates, setIsLoadingSorRates] = useState(false);
  
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const canCreateEstimates = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateEstimates;
  
  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      estimateNumber: `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000) + 1).padStart(4, '0')}`,
      date: new Date(),
      validUntil: addDays(new Date(), 30),
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
        
        const templateEstimateId = searchParams?.get('templateEstimateId');
        const workOrderId = searchParams?.get('workOrderId');
        const aiDraftParam = searchParams?.get('aiDraft');

        if (templateEstimateId) {
            const template = data.estimates.find((e: Estimate) => e.id === templateEstimateId);
            if (template && template.userId === dataOwnerId) {
                form.reset({
                    ...template,
                    date: new Date(), 
                    validUntil: template.validUntil ? addDays(new Date(), 30) : null,
                    status: 'draft',
                    estimateNumber: `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000) + 1).padStart(4, '0')}`,
                    items: template.items.map((item: EstimateItem) => ({...item, id: undefined, amount: item.quantity * item.rate })),
                });
                toast({ title: "Template Loaded", description: `Details from estimate ${template.estimateNumber} pre-filled.` });
            }
        } else if (workOrderId) {
             const woToLink: WorkOrder | undefined = data.workOrders.find((wo: WorkOrder) => wo.id === workOrderId);
            if(woToLink) {
                form.reset({
                    ...form.getValues(),
                    companyId: woToLink.companyId,
                    organizationId: woToLink.organizationId,
                    items: woToLink.items.map(item => ({ ...item, id: undefined, amount: item.rate * item.quantity })),
                    subjectOfWork: woToLink.scopeOfWork || "",
                    taxRate: woToLink.taxRate ?? undefined,
                    termsAndConditions: woToLink.termsAndConditions || "",
                    workOrderIdForLinking: woToLink.id,
                });
                toast({ title: "Work Order Linked", description: `Estimate pre-filled from Work Order.` });
            }
        } else if (aiDraftParam) {
            const aiDraftData = JSON.parse(decodeURIComponent(aiDraftParam));
            form.reset({
                ...form.getValues(),
                subjectOfWork: aiDraftData.subjectOfWork || "Generated from AI",
                items: aiDraftData.items.map((item: any) => ({ ...DEFAULT_ESTIMATE_ITEMS_FORM[0], ...item, amount: 0 })),
            });
            toast({ title: "AI Draft Loaded", description: "Estimate pre-filled from AI suggestions." });
        }
    } catch (error: any) {
        toast({ title: "Error", description: "Could not load required data.", variant: "destructive" });
    } finally {
        setIsLoadingDropdowns(false);
        setGlobalIsLoading(false);
    }
  }, [user, dataOwnerId, toast, searchParams, form, setGlobalIsLoading]);

  useEffect(() => {
    if(user && dataOwnerId && canCreateEstimates) {
        fetchPrerequisitesAndPrefill();
    }
  }, [user, dataOwnerId, canCreateEstimates, fetchPrerequisitesAndPrefill]);
  
  const handleCreateOrganization = async (orgName: string) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) return;
    
    const cost = appConfig.actionCosts?.find(c => c.key === 'ORGANIZATION_CREATION_COST')?.cost ?? ORGANIZATION_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;
    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
    }

    setIsCreatingOrg(true);
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ name: orgName, visibility: 'private', dataOwnerId }),
        });
        if (!response.ok) throw new Error((await response.json()).error || "Failed to create organization.");
        
        const newOrg: Organization & { newResourcePoints?: number } = await response.json();
        toast({ title: "Organization Created", description: `${newOrg.name} has been added.`});
        
        if (updateGlobalUserProfile && userProfile && newOrg.newResourcePoints !== undefined && dataOwnerId === user.uid) {
            updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: newOrg.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }});
        }
        
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
    if (!user || !dataOwnerId || !form.getValues("companyId") || !form.getValues("organizationId") || !userProfile || !appConfig) {
      toast({ title: "Missing Information", description: "User, company, or organization details are incomplete.", variant: "destructive" });
      setIsSubmitting(false);
      setGlobalIsLoading(false);
      return;
    }

    const cost = appConfig.actionCosts?.find(c => c.key === 'ESTIMATE_CREATION_COST')?.cost || ESTIMATE_CREATION_COST;
    const currentPoints = userProfile.resourcePoints || 0;
    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
    }

    const itemsWithAmounts = values.items.map(item => ({
        ...item,
        amount: (item.quantity || 0) * (item.rate || 0),
    }));

    const estimateDataForApi = {
      ...values,
      items: itemsWithAmounts,
      dataOwnerId: dataOwnerId,
      date: format(values.date, 'yyyy-MM-dd'),
      validUntil: values.validUntil ? format(values.validUntil, 'yyyy-MM-dd') : null,
      taxRate: values.taxRate ?? 0,
    };

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/estimates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(estimateDataForApi),
      });

      const createdEstimateResult = await response.json();

      if (!response.ok) {
        if(createdEstimateResult.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: createdEstimateResult.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(createdEstimateResult.error || `API request failed with status ${response.status}`);
        }
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
      }
      
      if (updateGlobalUserProfile && userProfile && createdEstimateResult.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ 
          userProfile: { ...userProfile, resourcePoints: createdEstimateResult.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }, 
          teamMemberPermissions: currentTeamMemberPermissions, 
          teamOwnerProfileData: null 
        });
      }

      toast({ title: "Success", description: `Estimate created successfully. Cost: ${createdEstimateResult.cost || 'N/A'} points.` });
      
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
  
  if (authLoading && !userProfile) return <NewEstimateLoading />;
  if (!user || !userProfile || !dataOwnerId) { router.push('/auth/signin'); return <NewEstimateLoading />; }
  
  if (!canCreateEstimates) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to create new estimates.</p>
        <Button asChild className="mt-4" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/estimates">Back to Estimates</Link>
        </Button>
      </div>
    );
  }
  
  const isLoadingForm = isLoadingDropdowns || isLoadingSorRates || isCreatingOrg;
  
  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <main className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Create New Estimate
            </h1>
            <p className="text-muted-foreground">Fill in the details to generate a new estimate.</p>
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
        
        {isLoadingDropdowns ? <NewEstimateLoading /> : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Estimate Details</CardTitle>
                <CardDescription>Select your company, client, and set general estimate terms.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Your Company*</FormLabel>
                      <FormControl>
                        <Combobox
                            options={companies}
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            placeholder="Select company..."
                            searchPlaceholder="Search..."
                            disabled={isLoadingDropdowns || companies.length === 0}
                            emptyResultText={isLoadingDropdowns? "Loading..." : "No companies found."}
                          />
                      </FormControl>
                      {companies.length === 0 && !isLoadingDropdowns && (
                        <FormDescription>
                          No companies found. <Link href="/dashboard/companies/new" className="underline">Add a company</Link>.
                        </FormDescription>
                      )}
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
                      <FormControl>
                        <Combobox
                          options={organizations}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          placeholder="Select or create client..."
                          searchPlaceholder="Search or type to create..."
                          creatable
                          onCreate={handleCreateOrganization}
                          disabled={isLoadingDropdowns || isCreatingOrg}
                          emptyResultText={isLoadingDropdowns ? "Loading..." : "No clients found."}
                        />
                      </FormControl>
                      <FormDescription>
                        If not available, type a new name to create it, or add it in the Organizations section first.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subjectOfWork"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Subject of Work</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief subject of work..."
                          {...field}
                          value={field.value ?? ""}
                          rows={2}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimateNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimate Number*</FormLabel>
                      <FormControl>
                        <Input placeholder="EST-001" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ESTIMATE_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
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
                      <FormLabel>Estimate Date*</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Valid Until</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={field.onChange}
                            disabled={(date) => date < (form.getValues("date") || new Date())}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Items Card – unchanged except safe imports */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Estimate Items</CardTitle>
                <CardDescription>Add items to the estimate. At least one item is required.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Item #{index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="text-destructive hover:text-destructive/90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemCode`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Code</FormLabel>
                          <FormControl>
                            <Input placeholder="SOR Code (opt)" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description*</FormLabel>
                          <Popover open={activePopoverIndex === index} onOpenChange={(open) => {
                            setActivePopoverIndex(open ? index : null);
                            if (!open) setCurrentSearchTerm('');
                          }}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Input
                                  placeholder="Item description or search SOR..."
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setCurrentSearchTerm(e.target.value);
                                    if (activePopoverIndex !== index) setActivePopoverIndex(index);
                                  }}
                                  onFocus={() => {
                                    setActivePopoverIndex(index);
                                    setCurrentSearchTerm(field.value ?? '');
                                  }}
                                />
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                <CommandInput
                                  placeholder="Search SOR..."
                                  value={currentSearchTerm}
                                  onValueChange={setCurrentSearchTerm}
                                />
                                <CommandList>
                                  {isLoadingSorRates && <CommandEmpty>Loading...</CommandEmpty>}
                                  {!isLoadingSorRates && filteredSorItems.length === 0 && <CommandEmpty>No SOR items found.</CommandEmpty>}
                                  <CommandGroup heading="Suggestions">
                                    {filteredSorItems.map((sor) => (
                                      <CommandItem
                                        key={sor.id || sor.itemCode}
                                        value={`${sor.itemCode} - ${sor.itemDescription}`}
                                        onSelect={() => {
                                          handleSorSelect(index, sor);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{sor.itemDescription || 'N/A'}</span>
                                          <span className="text-xs text-muted-foreground">
                                            Code: {sor.itemCode || 'N/A'} | Unit: {sor.unit || 'N/A'} | Rate: {formatCurrency(sor.rate || 0)}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            Search for an item. If not available, please create it in the SOR Rates section first.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity*</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit*</FormLabel>
                            <FormControl>
                              <Input placeholder="nos" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.rate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate ({formatCurrency(0).charAt(0)})*</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="0.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="text-right font-medium">
                      Item Amount: {formatCurrency((form.watch(`items.${index}.quantity`) || 0) * (form.watch(`items.${index}.rate`) || 0))}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ itemCode: "", description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 })}
                  className="mt-2 w-full sm:w-auto"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Summary & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="grid md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes..."
                              {...field}
                              value={field.value ?? ""}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="termsAndConditions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Terms & Conditions</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Payment terms..."
                              {...field}
                              value={field.value ?? ""}
                              rows={5}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Card className="p-4 bg-secondary/50">
                    <CardContent className="space-y-2 p-0">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">{formatCurrency(subTotal)}</span>
                      </div>
                      <FormField
                        control={form.control}
                        name="discount"
                        render={({ field }) => (
                          <FormItem className="flex justify-between items-center">
                            <FormLabel className="mb-0 whitespace-nowrap mr-2">Discount (₹):</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                className="w-24 text-right"
                                {...field}
                                value={field.value ?? ''}
                                onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage className="col-span-2 text-right" />
                          </FormItem>
                        )}
                      />
                       <div className="flex justify-between">
                        <span>Taxable Value:</span>
                        <span className="font-medium">{formatCurrency(taxableValue)}</span>
                      </div>
                      <FormField
                        control={form.control}
                        name="taxRate"
                        render={({ field }) => (
                          <FormItem className="flex justify-between items-center">
                            <FormLabel className="mb-0 whitespace-nowrap mr-2">Tax Rate (%):</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="18"
                                className="w-24 text-right"
                                {...field}
                                value={field.value ?? ''}
                                onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage className="col-span-2 text-right" />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-between">
                        <span>Tax Amount:</span>
                        <span className="font-medium">{formatCurrency(taxAmount)}</span>
                      </div>
                      <hr className="my-2 border-border" />
                      <div className="flex justify-between text-lg font-bold text-primary">
                        <span>Grand Total:</span>
                        <span>{formatCurrency(grandTotal)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoadingForm || authLoading || !canCreateEstimates}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting || isLoadingForm ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting || isLoadingForm ? "Saving..." : "Save Estimate"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
        )}
      </main>
    </>
  );
}

function NewEstimatePageWrapper() {
  return (
    <Suspense fallback={<NewEstimateLoading />}>
      <NewEstimatePageContent />
    </Suspense>
  );
}

export default NewEstimatePageWrapper;