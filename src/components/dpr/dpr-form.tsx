
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { DailyProgressReport, WorkOrder, AppConfiguration, DprConsumedItem } from '@/types';
import { DPR_CREATION_COST } from '@/lib/constants';
import { PlusCircle, Save, Loader2, CalendarIcon, ArrowLeft, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import DprDetailLoadingSkeleton from '@/app/dashboard/dpr/(form)/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { useLoading } from '@/contexts/loading-context';
import type { ConsumableItem } from '@/app/api/dpr/available-items/route';

const dprConsumedItemSchema = z.object({
    sourceType: z.enum(['work_order', 'inventory', 'purchase_order']),
    sourceId: z.string(),
    sourceName: z.string(),
    workOrderItemId: z.string().optional().nullable(),
    description: z.string(),
    unit: z.string(),
    consumedQuantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
    rate: z.coerce.number(),
    amount: z.coerce.number(),
});

const dprFormSchema = z.object({
  workOrderId: z.string().min(1, "Work Order is required."),
  reportDate: z.date({ required_error: "A report date is required." }),
  workUpToYesterday: z.string().min(1, "This field is required.").max(2000),
  todaysPlanning: z.string().min(1, "This field is required.").max(2000),
  todaysWorkAllocation: z.string().min(1, "This field is required.").max(2000),
  todaysCompletion: z.string().min(1, "This field is required.").max(2000),
  workRating: z.coerce.number().min(1).max(10),
  sitePhotos: z.array(z.string()).max(5).optional().nullable(),
  consumedItems: z.array(dprConsumedItemSchema).optional().nullable(),
});

type DprFormValues = z.infer<typeof dprFormSchema>;

interface DprFormProps {
    dprId?: string;
}

export function DprForm({ dprId }: DprFormProps) {
    const { user, userProfile, dataOwnerId, appConfig, updateGlobalUserProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [workOrderOptions, setWorkOrderOptions] = useState<ComboboxOption[]>([]);
    const [availableItems, setAvailableItems] = useState<ConsumableItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
    const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

    const isEditing = !!dprId;
    const canManage = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDpr;

    const form = useForm<DprFormValues>({
        resolver: zodResolver(dprFormSchema),
        defaultValues: { workRating: 8, consumedItems: [] },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "consumedItems" });
    const selectedWorkOrderId = form.watch('workOrderId');

    useEffect(() => {
        if (!authLoading && user && dataOwnerId && canManage) {
            const fetchWOs = async () => {
                setIsLoadingData(true);
                try {
                    const idToken = await user.getIdToken();
                    const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
                    if (!response.ok) throw new Error("Failed to fetch work orders");
                    const data: WorkOrder[] = await response.json();
                    setWorkOrderOptions(data.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));
                    
                    const woIdFromParams = searchParams?.get('workOrderId');
                    if (woIdFromParams && data.some(wo => wo.id === woIdFromParams)) {
                      form.setValue('workOrderId', woIdFromParams, { shouldValidate: true });
                    }
                } catch (error) { toast({ title: "Error", variant: "destructive" }); }
                setIsLoadingData(false);
            };
            
            const fetchDpr = async () => {
                if(!dprId) return;
                setIsLoadingData(true);
                try {
                    const idToken = await user.getIdToken();
                    const response = await fetch(`/api/dpr/${dprId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
                    if (!response.ok) throw new Error("Failed to fetch DPR data.");
                    const data: DailyProgressReport = await response.json();
                    form.reset({ ...data, reportDate: parseISO(data.reportDate) });
                } catch (error) {
                    toast({ title: "Error loading DPR", variant: "destructive" });
                    router.push('/dashboard/dpr');
                }
                setIsLoadingData(false);
            };

            fetchWOs();
            if(isEditing) fetchDpr(); else setIsLoadingData(false);
        } else if (!authLoading && !canManage) {
            setIsLoadingData(false);
        }
    }, [user, dataOwnerId, authLoading, canManage, dprId, isEditing, form, toast, router, searchParams]);
    
    useEffect(() => {
        if(selectedWorkOrderId) {
            setIsLoadingItems(true);
            const fetchItems = async () => {
                try {
                    const idToken = await user!.getIdToken();
                    const response = await fetch(`/api/dpr/available-items?workOrderId=${selectedWorkOrderId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
                    if(!response.ok) throw new Error("Could not load items for this WO.");
                    setAvailableItems(await response.json());
                } catch(e) { console.error(e); }
                finally { setIsLoadingItems(false); }
            };
            fetchItems();
        }
    }, [selectedWorkOrderId, user]);

    const handleAddItem = () => {
        append({
            sourceType: 'work_order', sourceId: '', sourceName: '',
            description: '', unit: '', consumedQuantity: 1, rate: 0, amount: 0
        });
    };

    const onSubmit = async (values: DprFormValues) => {
        if (!user || !dataOwnerId || !appConfig || !userProfile) return;
        
        const cost = appConfig?.actionCosts?.find(c => c.key === "DPR_CREATION_COST")?.cost ?? DPR_CREATION_COST;
        if (!isEditing && userProfile.resourcePoints! < cost) {
            setPointsInfo({ required: cost, current: userProfile.resourcePoints! });
            setIsPointsDialogOpen(true);
            return;
        }

        setIsSubmitting(true);
        const dataToSave = { ...values, reportDate: format(values.reportDate, 'yyyy-MM-dd'), dataOwnerId };
        const url = isEditing ? `/api/dpr/${dprId}` : '/api/dpr';
        const method = isEditing ? 'PUT' : 'POST';
        
        try {
            const idToken = await user.getIdToken();
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(dataToSave)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} DPR.`);

            if (!isEditing && updateGlobalUserProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Success", description: `DPR ${isEditing ? 'updated' : 'created'}.` });
            router.push('/dashboard/dpr');
        } catch(e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoadingData || authLoading) return <DprDetailLoadingSkeleton />;
    if (!canManage) return <div className="p-4"><AlertTriangle className="mr-2 h-4 w-4 inline"/> Permission Denied.</div>;

    return (
        <>
        <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center">
                        {isEditing ? <Edit className="mr-3 h-7 w-7 text-primary" /> : <PlusCircle className="mr-3 h-7 w-7 text-primary" />}
                        {isEditing ? 'Edit DPR' : 'Log New DPR'}
                    </h1>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/dpr"><ArrowLeft className="mr-2 h-4 w-4"/> Back to DPR List</Link></Button>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader><CardTitle>DPR Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="workOrderId" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Work Order*</FormLabel><Combobox options={workOrderOptions} {...field} placeholder="Select Work Order..." disabled={isLoadingData}/> <FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="reportDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Report Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            </div>
                            <FormField control={form.control} name="workUpToYesterday" render={({ field }) => ( <FormItem><FormLabel>Work Progress Up To Yesterday*</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="todaysPlanning" render={({ field }) => ( <FormItem><FormLabel>Today`s Planning*</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="todaysWorkAllocation" render={({ field }) => ( <FormItem><FormLabel>Today`s Work Allocation*</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="todaysCompletion" render={({ field }) => ( <FormItem><FormLabel>Today`s Completion Status*</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="workRating" render={({ field }) => ( <FormItem><FormLabel>Day`s Work Rating: {field.value}/10</FormLabel><FormControl><Slider value={[field.value]} onValueChange={(val) => field.onChange(val[0])} max={10} step={1} /></FormControl><FormMessage /></FormItem> )} />
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Consumed Materials/Services</CardTitle>
                            <CardDescription>Log items from inventory, WOs, or POs used today. This will be recorded as an expense.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {fields.map((item, index) => (
                                <div key={item.id} className="p-3 border rounded-md space-y-3 relative">
                                    <h4 className="font-medium text-sm">Item #{index + 1}</h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`consumedItems.${index}.description`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Item Description*</FormLabel>
                                                    <Combobox
                                                        options={availableItems.map(i => ({ value: i.description, label: `${i.description} (${i.sourceName})`, data: i }))}
                                                        value={field.value}
                                                        onChange={(val) => {
                                                            const selectedItem = availableItems.find(i => i.description === val);
                                                            if (selectedItem) {
                                                                form.setValue(`consumedItems.${index}.description`, selectedItem.description);
                                                                form.setValue(`consumedItems.${index}.unit`, selectedItem.unit);
                                                                form.setValue(`consumedItems.${index}.rate`, selectedItem.rate);
                                                                form.setValue(`consumedItems.${index}.sourceType`, selectedItem.sourceType);
                                                                form.setValue(`consumedItems.${index}.sourceId`, selectedItem.sourceId);
                                                                form.setValue(`consumedItems.${index}.sourceName`, selectedItem.sourceName);
                                                                if(selectedItem.workOrderItemId) form.setValue(`consumedItems.${index}.workOrderItemId`, selectedItem.workOrderItemId);
                                                            }
                                                        }}
                                                        placeholder="Search available items..."
                                                        disabled={isLoadingItems || !selectedWorkOrderId}
                                                    />
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                         <FormField control={form.control} name={`consumedItems.${index}.consumedQuantity`} render={({ field }) => (<FormItem><FormLabel>Quantity Consumed*</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={handleAddItem} disabled={!selectedWorkOrderId}><PlusCircle className="mr-2 h-4 w-4" />Add Consumed Item</Button>
                        </CardContent>
                     </Card>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save Report</>}</Button>
                    </CardFooter>
                </form>
            </Form>
        </div>
        </>
    );
}
