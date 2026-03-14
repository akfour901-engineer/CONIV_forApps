'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { FollowUp, Organization, WorkOrder, AppConfiguration } from '@/types';
import { FOLLOW_UP_STATUS_OPTIONS } from '@/types';
import { PlusCircle, Save, Loader2, CalendarIcon, ArrowLeft, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { FOLLOW_UP_CREATION_COST } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';
import NewFollowUpLoadingSkeleton from '@/app/dashboard/follow-ups/new/loading'; // Import the skeleton

const followUpFormSchema = z.object({
    organizationId: z.string().min(1, "Organization is required."),
    visitDate: z.date({ required_error: "A visit date is required." }),
    contactPerson: z.string().max(100).optional().nullable(),
    notes: z.string().min(1, "Notes are required.").max(2000),
    reminderDate: z.date({ required_error: "A reminder date is required." }),
    status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
}).refine(data => data.reminderDate >= data.visitDate, {
  message: "Reminder date must be on or after the visit date.",
  path: ["reminderDate"],
});

type FollowUpFormValues = z.infer<typeof followUpFormSchema>;

interface FollowUpFormProps {
    followUpId?: string;
}

export default function FollowUpForm({ followUpId }: FollowUpFormProps) {
    const { user, userProfile, dataOwnerId, appConfig, updateGlobalUserProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
    const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
    const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

    const isEditing = !!followUpId;
    const canManage = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOrganizations;

    const form = useForm<FollowUpFormValues>({
        resolver: zodResolver(followUpFormSchema),
        defaultValues: { status: 'pending', visitDate: new Date(), reminderDate: new Date() },
    });

    useEffect(() => {
        if (user && dataOwnerId) {
            const fetchInitialData = async () => {
                setIsLoading(true);
                try {
                    const idToken = await user.getIdToken();
                    const orgResponse = await fetch(`/api/organizations?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
                    if (!orgResponse.ok) throw new Error('Failed to fetch organizations.');
                    const orgsData: Organization[] = await orgResponse.json();
                    setOrganizations(orgsData.map(o => ({ value: o.id!, label: o.name })));

                    if (isEditing) {
                        const followUpResponse = await fetch(`/api/follow-ups/${followUpId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
                        if (!followUpResponse.ok) throw new Error('Failed to fetch follow-up data.');
                        const followUpData: FollowUp = await followUpResponse.json();
                        form.reset({
                            ...followUpData,
                            visitDate: parseISO(followUpData.visitDate),
                            reminderDate: parseISO(followUpData.reminderDate),
                        });
                    }
                } catch (error: any) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                    router.push('/dashboard/follow-ups');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchInitialData();
        }
    }, [user, dataOwnerId, isEditing, followUpId, form, router, toast]);

    const onSubmit = async (values: FollowUpFormValues) => {
        if (!user || !userProfile || !appConfig) return;
        
        if (!isEditing) {
            const cost = appConfig?.actionCosts?.find(c => c.key === 'FOLLOW_UP_CREATION_COST')?.cost ?? FOLLOW_UP_CREATION_COST;
            const currentPoints = userProfile.resourcePoints ?? 0;
            if (currentPoints < cost) {
                setPointsInfo({ required: cost, current: currentPoints });
                setIsPointsDialogOpen(true);
                return;
            }
        }
        
        setIsSubmitting(true);
        const dataToSave = {
            ...values,
            dataOwnerId: dataOwnerId,
            visitDate: format(values.visitDate, 'yyyy-MM-dd'),
            reminderDate: format(values.reminderDate, 'yyyy-MM-dd'),
        };

        const url = isEditing ? `/api/follow-ups/${followUpId}` : '/api/follow-ups';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const idToken = await user.getIdToken();
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(dataToSave),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to save follow-up.');
            
            toast({ title: "Success", description: `Follow-up ${isEditing ? 'updated' : 'created'} successfully.` });
            
            if (!isEditing && updateGlobalUserProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            router.push('/dashboard/follow-ups');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading || authLoading) { return <NewFollowUpLoadingSkeleton />; }
    if (!canManage) { return <div>Permission Denied.</div>; }

    return (
        <>
            <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold flex items-center">
                            {isEditing ? <Edit className="mr-3 h-7 w-7 text-primary" /> : <PlusCircle className="mr-3 h-7 w-7 text-primary" />}
                            {isEditing ? 'Edit Follow-up' : 'Add New Follow-up'}
                        </h1>
                        <p className="text-muted-foreground">{isEditing ? 'Modify the details of your follow-up.' : 'Log a new client interaction or reminder.'}</p>
                    </div>
                    <Button variant="outline" asChild><Link href="/dashboard/follow-ups"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Follow-ups</Link></Button>
                </div>
                <Card className="shadow-lg">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardHeader><CardTitle>Follow-up Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               <FormField control={form.control} name="organizationId" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Organization*</FormLabel><Combobox options={organizations} value={field.value} onChange={field.onChange} placeholder="Select Organization..." searchPlaceholder="Search..." disabled={isLoading || organizations.length === 0} emptyResultText={isLoading ? "Loading..." : "No organizations found."}/><FormMessage /></FormItem> )} />
                               <div className="grid md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="visitDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Visit/Interaction Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><span><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick a date"}</span></Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="reminderDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Reminder Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><span><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : "Pick a date"}</span></Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                               </div>
                                <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input placeholder="e.g., Mr. Sharma" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notes / Action Items*</FormLabel><FormControl><Textarea placeholder="e.g., Discussed preliminary drawings, client requested revised quote by Friday." {...field} rows={4} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Status"/></SelectTrigger></FormControl><SelectContent>{FOLLOW_UP_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            </CardContent>
                            <CardFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save Follow-up</>}</Button></CardFooter>
                        </form>
                    </Form>
                </Card>
            </div>
        </>
    );
}