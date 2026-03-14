'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { SorRate, Organization } from '@/types';
import { Edit, Save, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import EditSorRateLoadingSkeleton from '@/app/dashboard/sor-rates/[id]/edit/loading';
import { Label } from '../ui/label';

const sorRateFormSchema = z.object({
  itemCode: z.string().min(1, "Item code is required.").max(50),
  itemDescription: z.string().min(1, "Description is required.").max(500),
  unit: z.string().min(1, "Unit is required.").max(20),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
  organizationId: z.string().optional().nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
});

type SorRateFormValues = z.infer<typeof sorRateFormSchema>;

interface EditSorRatePageContentProps {
  sorRateId: string;
}

export default function EditSorRatePageContent({ sorRateId }: EditSorRatePageContentProps) {
  const { user, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [sorRate, setSorRate] = useState<SorRate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);

  const canManageOwnerSORs = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOwnerSORs;

  const form = useForm<SorRateFormValues>({
    resolver: zodResolver(sorRateFormSchema),
  });

  const fetchSorRateAndOrgs = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const [sorResponse, orgResponse] = await Promise.all([
        fetch(`/api/sor-rates/${sorRateId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/organizations?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      ]);

      if (!sorResponse.ok) throw new Error((await sorResponse.json()).error || 'Failed to fetch SOR Rate details.');
      const data: SorRate = await sorResponse.json();
      setSorRate(data);
      form.reset(data);

      if (orgResponse.ok) {
        const orgsData: Organization[] = await orgResponse.json();
        setOrganizations(orgsData.map(o => ({ value: o.id!, label: o.name })));
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
      router.push('/dashboard/sor-rates');
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, sorRateId, form, router, toast]);

  useEffect(() => {
    if (!authLoading && canManageOwnerSORs) {
      fetchSorRateAndOrgs();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, canManageOwnerSORs, fetchSorRateAndOrgs]);

  const onSubmit = async (values: SorRateFormValues) => {
    if (!user || !sorRateId || !canManageOwnerSORs) return;
    
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/sor-rates/${sorRateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });

      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update SOR item.');
      toast({ title: "Success", description: "SOR item updated successfully." });
      router.push('/dashboard/sor-rates');
    } catch (error: any) {
      toast({ title: "Error Updating Item", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <EditSorRateLoadingSkeleton />;
  
  if (!canManageOwnerSORs) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to edit SOR items.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/sor-rates">Back to SOR Rates</Link></Button>
      </div>
    );
  }
  
  if (!sorRate) return <div className="text-center p-4">SOR Rate not found or access denied.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Edit className="mr-3 h-7 w-7 text-primary" /> Edit SOR Rate
          </h1>
          <p className="text-muted-foreground">Modifying item: {sorRate.itemCode}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/sor-rates"><ArrowLeft className="mr-2 h-4 w-4" /> Back to SOR Rates</Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>SOR Item Details</CardTitle>
              <CardDescription>Update the information for this rate item.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="itemCode" render={({ field }) => (<FormItem><FormLabel>Item Code*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="itemDescription" render={({ field }) => (<FormItem><FormLabel>Item Description*</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="rate" render={({ field }) => (<FormItem><FormLabel>Rate (₹)*</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField
                  control={form.control}
                  name="organizationId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Associate with Organization (Optional)</FormLabel>
                      <Combobox
                        options={organizations}
                        value={field.value || ""}
                        onChange={(value) => field.onChange(value === "" ? null : value)}
                        placeholder="Select organization..."
                        searchPlaceholder="Search organizations..."
                        disabled={isLoadingOrganizations || organizations.length === 0}
                        emptyResultText={isLoadingOrganizations ? "Loading..." : "No organizations found."}
                      />
                      <FormDescription>If this rate is specific to a client/organization.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Visibility*</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                          <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="private" id="sor-private" /></FormControl><Label htmlFor="sor-private" className="font-normal">Private</Label></FormItem>
                          <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="public" id="sor-public" /></FormControl><Label htmlFor="sor-public" className="font-normal">Public</Label></FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
