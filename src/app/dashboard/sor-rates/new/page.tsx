'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import type { SorRate, Organization, AppConfiguration } from '@/types';
import { SOR_RATE_CREATION_COST, ORGANIZATION_CREATION_COST } from '@/lib/constants';
import { ListOrdered, PlusCircle, Save, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import NewSorRateLoading from './loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';

const sorRateFormSchema = z.object({
  itemCode: z.string().min(1, "Item code is required.").max(50),
  itemDescription: z.string().min(1, "Description is required.").max(500),
  unit: z.string().min(1, "Unit is required.").max(20),
  rate: z.coerce.number().min(0, "Rate must be non-negative."),
  organizationId: z.string().optional().nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
});

type SorRateFormValues = z.infer<typeof sorRateFormSchema>;

function NewSorRatePageContent() {
  const { user, userProfile, dataOwnerId, updateGlobalUserProfile, appConfig } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizations, setOrganizations] = useState<ComboboxOption[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const form = useForm<SorRateFormValues>({
    resolver: zodResolver(sorRateFormSchema),
    defaultValues: { itemCode: "", itemDescription: "", unit: "nos", rate: 0, organizationId: null, visibility: 'private' },
  });

  useEffect(() => {
    if (user && dataOwnerId) {
      setIsLoadingOrganizations(true);
      const fetchOrganizations = async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/organizations?dataOwnerId=${dataOwnerId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error('Failed to fetch organizations.');
          const orgsData: Organization[] = await response.json();
          const orgComboboxOpts = orgsData.map(org => ({ value: org.id!, label: org.name, data: org }));
          setOrganizations(orgComboboxOpts.sort((a, b) => a.label.localeCompare(b.label)));
        } catch (error) {
          console.error("Error fetching organizations for SOR:", error);
          toast({ title: "Error", description: "Could not load organizations.", variant: "destructive" });
        } finally {
          setIsLoadingOrganizations(false);
        }
      };
      fetchOrganizations();
    }
  }, [user, dataOwnerId, toast]);

  const handleCreateOrganization = async (orgName: string) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) return;

    const cost = appConfig?.actionCosts?.find(c => c.key === 'ORGANIZATION_CREATION_COST')?.cost ?? ORGANIZATION_CREATION_COST;
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
        const updatedProfile = { ...userProfile, resourcePoints: newOrg.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() };
        updateGlobalUserProfile({ userProfile: updatedProfile });
      }

      const newOption: ComboboxOption = { value: newOrg.id!, label: newOrg.name, data: newOrg };
      setOrganizations(prev => [...prev, newOption].sort((a,b) => a.label.localeCompare(b.label)));
      form.setValue('organizationId', newOrg.id!);
    } catch (error: any) {
      toast({ title: "Error", description: `Could not create organization: ${error.message}`, variant: "destructive" });
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const onSubmit = async (values: SorRateFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === 'SOR_RATE_CREATION_COST')?.cost ?? SOR_RATE_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;
    if (values.visibility === 'private' && currentPoints < cost) {
      setPointsInfo({ required: cost, current: currentPoints });
      setIsPointsDialogOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/sor-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ...values, dataOwnerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'INSUFFICIENT_POINTS') {
          toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
          throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }
        setIsSubmitting(false);
        return;
      }

      const createdItemResult: SorRate & { newResourcePoints?: number; cost?: number } = await response.json();
      
      if (updateGlobalUserProfile && userProfile && createdItemResult.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        const updatedProfile = { ...userProfile, resourcePoints: createdItemResult.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() };
        updateGlobalUserProfile({ userProfile: updatedProfile });
      }

      toast({ title: "Success" });
      router.push('/dashboard/sor-rates');
    } catch (error: any) {
      console.error('API /api/sor-rates POST error:', error);
      toast({ title: "Error Creating Item", description: error.message || 'An unknown error occurred.', variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingOrganizations) return <NewSorRateLoading />;

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard/sor-rates">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center">
                <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New SOR Item
              </h1>
              <p className="text-muted-foreground">Create a new item for your Schedule of Rates.</p>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>SOR Item Details</CardTitle>
                <CardDescription>Fill in the information for the rate item.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField 
                  control={form.control} 
                  name="itemCode" 
                  render={({ field }) => ( 
                    <FormItem> 
                      <FormLabel>Item Code*</FormLabel> 
                      <FormControl> 
                        <Input placeholder="e.g., CIVIL-001" {...field} /> 
                      </FormControl> 
                      <FormMessage /> 
                    </FormItem> 
                  )} 
                />
                <FormField 
                  control={form.control} 
                  name="itemDescription" 
                  render={({ field }) => ( 
                    <FormItem> 
                      <FormLabel>Item Description*</FormLabel> 
                      <FormControl> 
                        <Textarea placeholder="e.g., Earthwork excavation in ordinary soil" {...field} rows={3} /> 
                      </FormControl> 
                      <FormMessage /> 
                    </FormItem> 
                  )} 
                />
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField 
                    control={form.control} 
                    name="unit" 
                    render={({ field }) => ( 
                      <FormItem> 
                        <FormLabel>Unit*</FormLabel> 
                        <FormControl> 
                          <Input placeholder="e.g., cum, sqm, nos" {...field} /> 
                        </FormControl> 
                        <FormMessage /> 
                      </FormItem> 
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="rate" 
                    render={({ field }) => ( 
                      <FormItem> 
                        <FormLabel>Rate (₹)*</FormLabel> 
                        <FormControl> 
                          <Input type="number" placeholder="0.00" {...field} /> 
                        </FormControl> 
                        <FormMessage /> 
                      </FormItem> 
                    )} 
                  />
                </div>
                <FormField
                  control={form.control}
                  name="organizationId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Associate with Organization (Optional)</FormLabel>
                      <FormControl>
                        <Combobox
                          options={organizations}
                          value={field.value || ""}
                          onChange={(value) => field.onChange(value === "" ? null : value)}
                          placeholder="Select or create organization..."
                          searchPlaceholder="Search or type to create..."
                          creatable
                          onCreate={handleCreateOrganization}
                          disabled={isLoadingOrganizations || isCreatingOrg}
                          emptyResultText={isLoadingOrganizations ? "Loading..." : "No organization found."}
                        />
                      </FormControl>
                      <FormDescription>If this SOR item is specific to a client/organization.</FormDescription>
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
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1 md:flex-row md:space-x-4 md:space-y-0">
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="private" id="sor-private" />
                            </FormControl>
                            <Label htmlFor="sor-private" className="font-normal">
                              Private (Only your team can see and use)
                            </Label>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="public" id="sor-public" />
                            </FormControl>
                            <Label htmlFor="sor-public" className="font-normal">
                              Public (Visible to all users as templates)
                            </Label>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormDescription>Choose who can see and use this SOR item.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSubmitting ? "Saving..." : "Save Item"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}

function NewSorRatePageWrapper() {
  return (
    <Suspense fallback={<NewSorRateLoading />}>
      <NewSorRatePageContent />
    </Suspense>
  );
}
export default NewSorRatePageWrapper;
