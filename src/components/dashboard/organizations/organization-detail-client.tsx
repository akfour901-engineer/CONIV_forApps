
'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Organization, OrganizationStatusType, LeadSourceType, TeamMember } from '@/types';
import { ORGANIZATION_STATUS_OPTIONS, LEAD_SOURCE_OPTIONS, ORGANIZATION_TYPES_OPTIONS } from '@/types';
import { Building2, Edit, Save, ArrowLeft, Loader2, CalendarIcon, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import OrganizationDetailLoadingSkeleton from '@/app/dashboard/organizations/[id]/organization-detail-loading';

// Create a mutable copy for z.enum
const mutableLeadSourceOptions: [string, ...string[]] = [...LEAD_SOURCE_OPTIONS];
const mutableOrgStatusOptions: [string, ...string[]] = [...ORGANIZATION_STATUS_OPTIONS];

const organizationFormSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters.").max(100),
  type: z.string().max(100).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().refine(val => !val || /^\d{6}$/.test(val), { message: "Pincode must be 6 digits if provided." }).optional().nullable(),
  gstin: z.string().refine(val => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), { message: "GSTIN must be valid." }).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email("Invalid email.").optional().nullable(),
  contactPhone: z.string().refine(val => !val || /^\+?[0-9\s-()]{7,20}$/.test(val), { message: "Invalid phone." }).optional().nullable(),
  visibility: z.enum(['public', 'private']).default('private'),
  organizationStatus: z.enum(mutableOrgStatusOptions).optional().nullable(),
  leadSource: z.enum(mutableLeadSourceOptions).optional().nullable(),
  nextFollowUpDate: z.date().optional().nullable(),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;


interface OrganizationDetailClientPageProps {
  organizationId: string;
  startInEditMode?: boolean;
}

export default function OrganizationDetailClientPage({ organizationId, startInEditMode = false }: OrganizationDetailClientPageProps) {
  const { user, loading: authLoading, dataOwnerId, isViewingOwnAccount, currentTeamMemberPermissions } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(startInEditMode);

  const canManageOrg = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOrganizations;

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
  });

  useEffect(() => {
    if (authLoading || !user || !dataOwnerId) {
        if(!authLoading && !user) router.push('/auth/signin');
        return;
    }
    
    const fetchOrganization = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/organizations/${organizationId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
          throw new Error(errorData.error || `Failed to fetch organization: ${response.status}`);
        }
        
        const data: Organization = await response.json();
        setOrganization(data);
        form.reset({
          ...data,
          type: data.type || "",
          nextFollowUpDate: data.nextFollowUpDate ? parseISO(data.nextFollowUpDate) : null,
        });

      } catch (error: any) {
        console.error("Error fetching organization via API:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        router.push('/dashboard/organizations');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrganization();
  }, [organizationId, user, dataOwnerId, authLoading, router, toast, form]);


  const onSubmit = async (values: OrganizationFormValues) => {
    if (!user || !organizationId || !dataOwnerId || !organization) {
        toast({title: "Error", variant: "destructive"});
        return;
    }
    if (!canManageOrg) {
        toast({title: "Permission Denied", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    const dataToUpdate = {
        ...values,
        nextFollowUpDate: values.nextFollowUpDate ? format(values.nextFollowUpDate, 'yyyy-MM-dd') : null,
    };

    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/organizations/${organizationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(dataToUpdate),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
            throw new Error(errorData.error || 'Failed to update organization.');
        }

        const updatedOrg: Organization = await response.json();
        toast({ title: "Success", description: "Organization details updated." });
        setOrganization(updatedOrg);
        setIsEditing(false);
    } catch (error: any) {
        console.error("Error updating organization:", error);
        toast({ title: "Error Updating", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEditToggle = () => {
    if (canManageOrg) {
      setIsEditing(!isEditing);
      if (!isEditing && organization) { 
        form.reset({
            ...organization,
            type: organization.type || "",
            nextFollowUpDate: organization.nextFollowUpDate ? parseISO(organization.nextFollowUpDate) : null,
        });
      }
    } else {
      toast({title: "Permission Denied", description: "You cannot edit this organization.", variant: "destructive"});
    }
  };
  
  if (isLoading || authLoading) return <OrganizationDetailLoadingSkeleton />;

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Not Found or Access Denied</h2>
        <p className="text-muted-foreground">The requested organization could not be found or you do not have permission to view it.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/organizations">Back to Organizations</Link></Button>
      </div>
    );
  }
  
  const canEditThisOrg = (organization.visibility === 'private' && canManageOrg) || (organization.visibility === 'public' && isViewingOwnAccount && organization.userId === user?.uid);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Building2 className="mr-3 h-7 w-7 text-primary" /> {isEditing ? 'Edit' : 'View'} Organization
          </h1>
          <p className="text-muted-foreground">{organization.name}</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/dashboard/organizations"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            {canEditThisOrg && (
                <Button onClick={handleEditToggle} variant={isEditing ? "secondary" : "default"}>
                  <Edit className="mr-2 h-4 w-4"/> {isEditing ? 'Cancel' : 'Edit'}
                </Button>
            )}
        </div>
      </div>
      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader><CardTitle>Organization Information</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name*</FormLabel><FormControl><Input {...field} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value || ""} disabled={!isEditing}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{ORGANIZATION_TYPES_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <Separator />
              <div className="grid md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <Separator />
               <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid md:grid-cols-3 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="pincode" render={({ field }) => (<FormItem><FormLabel>Pincode</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
            {isEditing && (
              <CardFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/> Save Changes</>}
                </Button>
              </CardFooter>
            )}
          </form>
        </Form>
      </Card>
    </div>
  );
}


  