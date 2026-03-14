

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Users, PlusCircle, Save, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import type { Organization, OrganizationType, AppConfiguration, TeamPermissions, OrganizationStatusType, LeadSourceType } from '@/types';
import { ORGANIZATION_TYPES_OPTIONS, ORGANIZATION_STATUS_OPTIONS, LEAD_SOURCE_OPTIONS } from '@/types';
import NewOrganizationLoadingSkeleton from './loading';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { ORGANIZATION_CREATION_COST } from '@/lib/constants';

const organizationFormSchema = z.object({
  name: z.string().min(2, { message: "Organization name must be at least 2 characters." }).max(100),
  type: z.string().max(100).optional().nullable(),
  address: z.string().max(300).optional().or(z.literal('')).nullable(),
  city: z.string().max(100).optional().or(z.literal('')).nullable(),
  state: z.string().max(100).optional().or(z.literal('')).nullable(),
  pincode: z.string().refine(val => val === '' || val === null || /^\d{6}$/.test(val), { message: "Pincode must be 6 digits if provided." }).optional().or(z.literal('')).nullable(),
  gstin: z.string().refine(val => val === '' || val === null || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), { message: "GSTIN must be valid." }).optional().or(z.literal('')).nullable(),
  contactPerson: z.string().max(100).optional().or(z.literal('')).nullable(),
  contactEmail: z.string().email().optional().or(z.literal('')).nullable(),
  contactPhone: z.string().refine(val => val === '' || val === null || /^\+?[0-9\s-()]{7,20}$/.test(val), { message: "Invalid phone." }).optional().or(z.literal('')).nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
  organizationStatus: z.enum(ORGANIZATION_STATUS_OPTIONS).optional().nullable(),
  leadSource: z.enum(LEAD_SOURCE_OPTIONS).optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export default function NewOrganizationPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canCreateOrganizations = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOrganizations;

  const form = useForm<z.infer<typeof organizationFormSchema>>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: "", type: "", address: "", city: "", state: "", pincode: "", gstin: "",
      contactPerson: "", contactEmail: "", contactPhone: "",
      visibility: "private",
    },
  });

  const onSubmit = async (values: z.infer<typeof organizationFormSchema>) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canCreateOrganizations) {
        toast({ title: "Permission Denied", description: "You do not have permission to add organizations.", variant: "destructive" });
        return;
    }
    
    const cost = appConfig.actionCosts?.find(c => c.key === 'ORGANIZATION_CREATION_COST')?.cost ?? ORGANIZATION_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
    }

    setIsSubmitting(true);
    const orgDataForApi = { ...values, dataOwnerId: dataOwnerId };
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(orgDataForApi),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }
        setIsSubmitting(false);
        return;
      }
      
      const createdOrganization: Organization & { newResourcePoints?: number; cost?: number } = await response.json();
      
      if (updateGlobalUserProfile && userProfile && createdOrganization.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: createdOrganization.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }});
      }

      toast({ title: "Success", description: `Organization added successfully. Cost: ${createdOrganization.cost || 'N/A'} points.` });
      
      router.push('/dashboard/organizations');

    } catch (error: any) {
      console.error('Error creating organization via API: ', error);
      toast({ title: 'Error Creating Organization', description: error.message || 'An unknown error occurred.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (authLoading && !userProfile) {
    return <NewOrganizationLoadingSkeleton />;
  }
  if (!user || !userProfile || !dataOwnerId) {
    router.push('/auth/signin');
    return <NewOrganizationLoadingSkeleton />; 
  }
  if (!canCreateOrganizations) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to create new organizations.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/organizations">Back to Organizations</Link>
        </Button>
      </div>
    );
  }


  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New Organization/Client
            </h1>
            <p className="text-muted-foreground">Enter details for the new organization or client.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/organizations">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>Fill in the core details and CRM information below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section className="space-y-4">
                  <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Basic Details</h3>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Organization Name*</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Acme Corp, Client Name (Individual)" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Organization Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select organization type" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {ORGANIZATION_TYPES_OPTIONS.map((typeOpt) => (
                                <SelectItem key={typeOpt} value={typeOpt}>
                                {typeOpt}
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
                    name="gstin"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>GSTIN</FormLabel>
                        <FormControl>
                            <Input placeholder="Organization's GSTIN" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>15-character Goods and Services Tax ID (if applicable).</FormDescription>
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
                            <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-1 md:flex-row md:space-x-4 md:space-y-0"
                            >
                            <div className="flex items-center space-x-3 space-y-0">
                                <RadioGroupItem value="private" id="new-org-private" />
                                <Label htmlFor="new-org-private" className="font-normal">
                                Private (Only your team)
                                </Label>
                            </div>
                            <div className="flex items-center space-x-3 space-y-0">
                                <RadioGroupItem value="public" id="new-org-public" />
                                <Label htmlFor="new-org-public" className="font-normal">
                                Public (Visible to all users)
                                </Label>
                            </div>
                            </RadioGroup>
                        </FormControl>
                        <FormDescription>Choose who can see this organization`s details.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </section>
                <Separator />
                <section className="space-y-4">
                  <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Address Details</h3>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Full Address</FormLabel>
                        <FormControl>
                            <Textarea placeholder="e.g., 123 Business Rd, Suite 400" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <div className="grid md:grid-cols-3 gap-4">
                 <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Metropolis" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>State / Province</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., California" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormField
                    control={form.control}
                    name="pincode"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Pincode / Zip Code</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 90210" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    </div>
                </section>
                <Separator />
                <section className="space-y-4">
                  <h3 className="text-lg font-medium text-primary border-b pb-2 mb-4">Contact Information</h3>
                   <div className="grid md:grid-cols-3 gap-4">
                   <FormField
                    control={form.control}
                    name="contactPerson"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contact Person</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Jane Doe" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                            <Input
                            type="email"
                            placeholder="e.g., contact@acmecorp.com"
                            {...field}
                            value={field.value || ""}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                            <Input
                            type="tel"
                            placeholder="e.g., +1 555-123-4567"
                            {...field}
                            value={field.value || ""}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    /></div>
                </section>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSubmitting ? "Saving..." : "Save Organization"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}
