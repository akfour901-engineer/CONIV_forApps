
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, ServiceVisitReport, SorRate } from '@/types';
import { PlusCircle, Save, Loader2, CalendarIcon, UploadCloud, ArrowLeft, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { SERVICE_VISIT_REPORT_CREATION_COST } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';
import NewSvrLoadingSkeleton from '@/app/dashboard/svr/new/loading';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const svrConsumedItemSchema = z.object({
  sourceType: z.enum(['work_order', 'inventory', 'purchase_order']),
  sourceId: z.string(),
  sourceName: z.string(),
  workOrderItemId: z.string().optional(),
  description: z.string(),
  unit: z.string(),
  consumedQuantity: z.coerce.number().min(0),
  rate: z.coerce.number(),
  amount: z.coerce.number(),
});


const svrFormSchema = z.object({
  workOrderId: z.string().min(1, "Work Order is required."),
  visitDate: z.date({ required_error: "A visit date is required." }),
  purposeOfVisit: z.string().min(1, "This field is required.").max(500),
  actionsTaken: z.string().min(1, "This field is required.").max(2000),
  nextSteps: z.string().max(1000).optional().nullable(),
  clientFeedback: z.string().max(1000).optional().nullable(),
  visitRating: z.coerce.number().min(1).max(10),
  consumedItems: z.array(svrConsumedItemSchema).optional().nullable(),
});

type SvrFormValues = z.infer<typeof svrFormSchema>;

interface SvrFormProps {
    svrId?: string;
}

export function SvrForm({ svrId }: SvrFormProps) {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { setIsLoading: setGlobalIsLoading } = useLoading();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
    const [availableSorItems, setAvailableSorItems] = useState<SorRate[]>([]);
    const [isLoadingPrereqs, setIsLoadingPrereqs] = useState(true);
    
    const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
    const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
    
    const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);
    const [currentSearchTerm, setCurrentSearchTerm] = useState('');

    const isEditing = !!svrId;
    const canManageSvr = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageSvr;
    const workOrderIdFromParams = searchParams?.get('workOrderId');

    const form = useForm<SvrFormValues>({
        resolver: zodResolver(svrFormSchema),
        defaultValues: { visitDate: new Date(), visitRating: 8, consumedItems: [] },
    });

    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "consumedItems",
    });

    const fetchPrerequisites = useCallback(async () => {
        if (!user || !dataOwnerId) return;
        setIsLoadingPrereqs(true);
        try {
            const idToken = await user.getIdToken();
            const [woResponse, sorResponse] = await Promise.all([
                fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                fetch(`/api/sor-rates?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` }})
            ]);
            
            if (!woResponse.ok) throw new Error('Failed to fetch work orders.');
            const woData: WorkOrder[] = await woResponse.json();
            setWorkOrders(woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));

            if (!sorResponse.ok) throw new Error('Failed to fetch SOR rates.');
            setAvailableSorItems(await sorResponse.json());

            if (isEditing && svrId) {
                const svrResponse = await fetch(`/api/svr/${svrId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
                if (!svrResponse.ok) throw new Error('Failed to fetch SVR data.');
                const svrData: ServiceVisitReport = await svrResponse.json();
                form.reset({
                    ...svrData,
                    visitDate: svrData.visitDate ? parseISO(svrData.visitDate) : new Date(),
                });
            } else if (workOrderIdFromParams) {
                form.setValue('workOrderId', workOrderIdFromParams);
            }
        } catch (error: any) {
            toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoadingPrereqs(false);
        }
    }, [user, dataOwnerId, toast, isEditing, svrId, workOrderIdFromParams, form]);

    useEffect(() => {
        if (!authLoading && canManageSvr) {
            fetchPrerequisites();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [authLoading, canManageSvr, fetchPrerequisites]);


    const onSubmit = async (values: SvrFormValues) => {
        if (!user || !userProfile || !dataOwnerId || !appConfig) return;
        
        const cost = appConfig?.actionCosts?.find(c => c.key === 'SERVICE_VISIT_REPORT_CREATION_COST')?.cost ?? 0;
        if (!isEditing && currentTeamMemberPermissions && userProfile.resourcePoints! < cost) {
            setPointsInfo({ required: cost, current: userProfile.resourcePoints ?? 0 });
            setIsPointsDialogOpen(true);
            return;
        }

        setIsSubmitting(true);
        const dataToSave = { ...values, date: format(values.visitDate, 'yyyy-MM-dd'), dataOwnerId };

        const url = isEditing ? `/api/svr/${svrId}` : '/api/svr';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const idToken = await user.getIdToken();
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, body: JSON.stringify(dataToSave) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} SVR.`);
            
            toast({ title: "Success", description: `SVR ${isEditing ? 'updated' : 'created'}.` });
            if (!isEditing && result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            router.push('/dashboard/svr');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSorSelect = useCallback((index: number, sor: SorRate) => {
        form.setValue(`consumedItems.${index}.description`, sor.itemDescription || "");
        form.setValue(`consumedItems.${index}.unit`, sor.unit || "nos");
        form.setValue(`consumedItems.${index}.rate`, sor.rate || 0);
        setActivePopoverIndex(null);
        setCurrentSearchTerm('');
    }, [form]);

    const filteredSorItems = useMemo(() => {
        const currentItems = new Set((form.watch('consumedItems') || []).map(i => i.description));
        return availableSorItems.filter(sor => !currentItems.has(sor.itemDescription))
            .filter(sor => sor.itemDescription.toLowerCase().includes(currentSearchTerm.toLowerCase()))
            .slice(0, 5);
    }, [availableSorItems, currentSearchTerm, form]);


    if (isLoading || authLoading) return <NewSvrLoadingSkeleton />;
    if (!canManageSvr) {
        return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"> <AlertTriangle className="w-16 h-16 text-destructive mb-4" /> <h2 className="text-xl font-semibold">Permission Denied</h2> <p className="text-muted-foreground">You do not have permission to manage Service Visit Reports.</p> <Button asChild><Link href="/dashboard/svr">Back to SVRs</Link></Button> </div> );
    }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center">
            {isEditing ? <Edit className="mr-3 h-7 w-7 text-primary" /> : <PlusCircle className="mr-3 h-7 w-7 text-primary" />}
            {isEditing ? 'Edit Service Visit Report' : 'Log New Service Visit Report'}
          </h1>
          <Button variant="outline" asChild><Link href="/dashboard/svr"><ArrowLeft className="mr-2 h-4 w-4"/> Back to SVRs</Link></Button>
        </div>
        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader><CardTitle>Visit Details</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid md:grid-cols-2 gap-4">
                     <FormField control={form.control} name="workOrderId" render={({ field }) => ( <FormItem><FormLabel>Work Order*</FormLabel><Combobox options={workOrders} {...field} placeholder="Select Work Order..." searchPlaceholder="Search..." disabled={isLoadingPrereqs} /><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="visitDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Visit Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start font-normal", !field.value && "text-muted-foreground")}><span><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick a date"}</span></Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                 </div>
                  <FormField control={form.control} name="purposeOfVisit" render={({ field }) => (<FormItem><FormLabel>Purpose of Visit*</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="actionsTaken" render={({ field }) => (<FormItem><FormLabel>Actions Taken / Work Performed*</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="nextSteps" render={({ field }) => (<FormItem><FormLabel>Next Steps (Optional)</FormLabel><FormControl><Textarea {...field} rows={2} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="clientFeedback" render={({ field }) => (<FormItem><FormLabel>Client Feedback (Optional)</FormLabel><FormControl><Textarea {...field} rows={2} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="visitRating" render={({ field }) => (<FormItem><FormLabel>Visit Rating (out of 10)*</FormLabel><FormControl><Input type="number" min={1} max={10} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
              <CardHeader><CardTitle>Consumed Items (Optional)</CardTitle><CardDescription>Log any materials or services used during this visit.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                  {fields.map((item, index) => (
                      <div key={item.id} className="p-3 border rounded-md space-y-2 relative">
                         <div className="flex justify-between items-center"><h5 className="font-medium">Item #{index + 1}</h5><Button type="button" variant="ghost" size="icon" onClick={()=>remove(index)}><Trash2 className="h-4 w-4"/></Button></div>
                         <Controller control={form.control} name={`consumedItems.${index}.description`} render={({field}) => (<FormItem><FormLabel>Description*</FormLabel><Popover open={activePopoverIndex === index} onOpenChange={(open) => setActivePopoverIndex(open ? index : null)}><PopoverTrigger asChild><FormControl><Input placeholder="Item description or search SOR..." {...field} /></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search SOR..." onValueChange={setCurrentSearchTerm}/><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup>{filteredSorItems.map((sor) => (<CommandItem key={sor.id} value={sor.itemDescription} onSelect={() => handleSorSelect(index, sor)}>{sor.itemDescription}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                         <div className="grid sm:grid-cols-3 gap-4">
                            <FormField control={form.control} name={`consumedItems.${index}.consumedQuantity`} render={({field}) => (<FormItem><FormLabel>Quantity*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                            <FormField control={form.control} name={`consumedItems.${index}.unit`} render={({field}) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>)}/>
                            <FormField control={form.control} name={`consumedItems.${index}.rate`} render={({field}) => (<FormItem><FormLabel>Rate (₹)*</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                        </div>
                      </div>
                  ))}
                  <Button type="button" variant="outline" onClick={() => append({ sourceType: 'inventory', sourceId: '', sourceName: '', description: '', unit: '', consumedQuantity: 1, rate: 0, amount: 0 })}><PlusCircle className="mr-2 h-4 w-4"/>Add Item</Button>
              </CardContent>

              <CardFooter>
                <Button type="submit" disabled={isSubmitting || isLoading}>{isSubmitting || isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save SVR</>}</Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}
