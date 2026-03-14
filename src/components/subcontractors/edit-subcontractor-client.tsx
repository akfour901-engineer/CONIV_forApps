
'use client';

import React, { useState, useEffect } from 'react';
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
import type { Subcontractor } from '@/types';
import { Edit, Save, ArrowLeft, Loader2, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';
import EditSubcontractorLoadingSkeleton from '@/app/dashboard/subcontractors/[id]/edit/loading';

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
});

type SubcontractorFormValues = z.infer<typeof subcontractorFormSchema>;

export default function EditSubcontractorPageContent({ subcontractorId }: { subcontractorId: string }) {
  const { user, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const canManageSubcontractors = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageSubcontractors;

  const form = useForm<SubcontractorFormValues>({
    resolver: zodResolver(subcontractorFormSchema),
  });

  useEffect(() => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    if (!canManageSubcontractors) {
        toast({ title: "Permission Denied", variant: "destructive" });
        router.push('/dashboard/subcontractors');
        return;
    }
    
    const fetchSubcontractor = async () => {
        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/subcontractors/${subcontractorId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch subcontractor.');
            const data: Subcontractor = await response.json();
            form.reset(data);
        } catch (error: any) {
            toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
            router.push('/dashboard/subcontractors');
        }
        setIsLoading(false);
    };
    fetchSubcontractor();
  }, [user, dataOwnerId, subcontractorId, canManageSubcontractors, form, router, toast]);

  const onSubmit = async (values: SubcontractorFormValues) => {
    if (!user || !canManageSubcontractors) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/subcontractors/${subcontractorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update subcontractor.');
      toast({ title: "Success", description: "Subcontractor updated successfully." });
      router.push('/dashboard/subcontractors');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <EditSubcontractorLoadingSkeleton />;
  if (!canManageSubcontractors) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to edit subcontractors.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/subcontractors">Back</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold flex items-center"><Edit className="mr-3 h-7 w-7 text-primary" /> Edit Subcontractor</h1><p className="text-muted-foreground">Modify details for {form.getValues('name')}.</p></div>
        <Button variant="outline" asChild><Link href="/dashboard/subcontractors"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Subcontractors</Link></Button>
      </div>
      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader><CardTitle>Subcontractor Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="specialization" render={({ field }) => (<FormItem><FormLabel>Specialization*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} rows={3} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={3} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="rating" render={({ field }) => (<FormItem><FormLabel>Rating</FormLabel><Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{[1,2,3,4,5].map(r => <SelectItem key={r} value={String(r)}>{r} Star{r>1 && 's'}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{['active', 'inactive', 'on_hold'].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : <><Save className="mr-2 h-4 w-4" /> Update Subcontractor</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
