'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Save, ArrowLeft, Loader2, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { SUBCONTRACTOR_CREATION_COST } from '@/lib/constants';
import NewSubcontractorPageSkeleton from '@/app/dashboard/subcontractors/new/loading';
import type { Subcontractor } from '@/types';

const subcontractorFormSchema = z.object({
  name: z.string().min(2, "Name is required.").max(100),
  specialization: z.string().min(2, "Specialization is required.").max(100),
  contactPerson: z.string().max(100).optional().nullable(),
  email: z.string().email("Invalid email.").optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  rating: z.coerce.number().min(1).max(5).default(3),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive', 'on_hold']).default('active'),
  dataOwnerId: z.string().min(1, "Data owner context is required."),
});

type SubcontractorFormValues = z.infer<typeof subcontractorFormSchema>;

export default function NewSubcontractorPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  
  const canManageSubcontractors = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageSubcontractors;

  const form = useForm<SubcontractorFormValues>({
    resolver: zodResolver(subcontractorFormSchema),
    defaultValues: { name: "", specialization: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", rating: 3, notes: "", status: 'active' },
  });

  const onSubmit = async (values: SubcontractorFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    if (!canManageSubcontractors) {
        toast({ title: "Permission Denied", variant: "destructive" });
        return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === "SUBCONTRACTOR_CREATION_COST")?.cost ?? SUBCONTRACTOR_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
      setPointsInfo({ required: cost, current: currentPoints });
      setIsPointsDialogOpen(true);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/subcontractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, dataOwnerId: dataOwnerId }),
      });
      const result: Subcontractor & { newResourcePoints?: number; cost?: number; error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create subcontractor.');

      if (updateGlobalUserProfile && userProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints }}, user);
      }
      
      toast({ title: "Success", description: "Subcontractor created successfully." });
      router.push('/dashboard/subcontractors');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authLoading) return <NewSubcontractorPageSkeleton />;
  if (!canManageSubcontractors) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage subcontractors.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/subcontractors">Back</Link></Button>
      </div>
    );
  }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold flex items-center"><PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New Subcontractor</h1><p className="text-muted-foreground">Enter details for a new subcontractor or vendor.</p></div>
          <Button variant="outline" asChild><Link href="/dashboard/subcontractors"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subcontractors</Link></Button>
        </div>
        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader><CardTitle>Subcontractor Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name*</FormLabel><FormControl><Input placeholder="e.g., Star Electricals" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="specialization" render={({ field }) => (<FormItem><FormLabel>Specialization*</FormLabel><FormControl><Input placeholder="e.g., Electrical Works, Plumbing" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input placeholder="e.g., Mr. John Smith" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} rows={3} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Any notes about reliability, past work, etc." {...field} rows={3} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="rating" render={({ field }) => (<FormItem><FormLabel>Rating</FormLabel><Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{[1,2,3,4,5].map(r => <SelectItem key={r} value={String(r)}>{r} Star{r>1 && 's'}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{['active', 'inactive', 'on_hold'].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Subcontractor</>}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}