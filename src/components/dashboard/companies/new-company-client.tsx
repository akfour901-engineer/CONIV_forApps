
'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Save, Loader2, ArrowLeft, AlertTriangle, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import NewCompanyLoadingSkeleton from '@/app/dashboard/companies/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { COMPANY_CREATION_COST } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';
import { Separator } from '@/components/ui/separator';
import type { Company, AppConfigActionCost } from '@/types';

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const companyFormSchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }).max(100),
  companyType: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  logoUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Logo image is too large.").optional().nullable(), // Allow for base64 overhead
  gstin: z.string()
    .refine(val => val === '' || val === null || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), {
      message: "GSTIN must be a valid 15-character format if provided.",
    })
    .optional().nullable(),
  panNumber: z.string()
    .refine(val => val === '' || val === null || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val), {
      message: "PAN must be a valid 10-character format if provided.",
    })
    .optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  establishedYear: z.coerce.number().int().min(1800, "Invalid year.").max(new Date().getFullYear(), "Year cannot be in the future.").optional().nullable(),
  address: z.string().min(5, { message: "Address must be at least 5 characters." }).max(300),
  website: z.string().url({ message: "Please enter a valid URL." }).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().nullable(),
  contactPhone: z.string()
    .refine(val => val === '' || val === null || /^\+?[0-9\s-()]{7,20}$/.test(val), {
      message: "Invalid phone number format.",
    })
    .optional().nullable(),
  role: z.string().max(50).optional().nullable(),
  dataOwnerId: z.string().min(1),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

const ROLES_OPTIONS = ['Owner', 'Director', 'Manager', 'Accountant', 'Employee', 'Consultant', 'Other'];
const COMPANY_TYPES_OPTIONS = ['Proprietorship', 'Partnership', 'Private Limited Company', 'Public Limited Company', 'Limited Liability Partnership (LLP)', 'One Person Company (OPC)', 'Section 8 Company (NPO)', 'Sole Proprietorship', 'Joint Venture', 'Other'];

export default function NewCompanyPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const canCreateCompany = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageCompanies;
  
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      address: "",
      dataOwnerId: dataOwnerId || "",
    },
  });
  
  useEffect(() => {
    if (dataOwnerId) {
      form.setValue('dataOwnerId', dataOwnerId);
    }
  }, [dataOwnerId, form]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Logo file cannot exceed ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (logoInputRef.current) logoInputRef.current.value = "";
        form.setValue('logoUrl', null);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('logoUrl', reader.result as string);
        toast({ title: "Logo Ready", description: "Logo will be uploaded upon saving." });
      };
      reader.onerror = () => toast({ title: "File Read Error", variant: "destructive" });
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: CompanyFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canCreateCompany) {
        toast({ title: "Permission Denied", description: "You do not have permission to add companies.", variant: "destructive" });
        return;
    }
    
    const cost = appConfig.actionCosts?.find(c => c.key === "COMPANY_CREATION_COST")?.cost ?? COMPANY_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
    }

    setIsSubmitting(true);
    setGlobalIsLoading(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || 'Failed to create company.');
        }
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
      }
      
      const createdCompany: Company & { newResourcePoints?: number } = await response.json();
      
      if (updateGlobalUserProfile && userProfile && createdCompany.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        const updatedProfile = { ...userProfile, resourcePoints: createdCompany.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() };
        updateGlobalUserProfile({ userProfile: updatedProfile, teamMemberPermissions: currentTeamMemberPermissions, teamOwnerProfileData: null });
      }
      
      toast({ title: "Success", description: "Company created successfully." });
      router.push('/dashboard/companies');

    } catch (error: any) {
      console.error("Error creating company via API: ", error);
      toast({ title: "Error Creating Company", description: error.message, variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading && !userProfile) {
    return <NewCompanyLoadingSkeleton />;
  }
  if (!user || !userProfile) {
    router.push('/auth/signin');
    return <NewCompanyLoadingSkeleton />; 
  }
  if (!canCreateCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to create new companies.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/companies">Back to Companies</Link>
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
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New Company
            </h1>
            <p className="text-muted-foreground">Enter details for a new business entity you own or manage.</p>
          </div>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/companies">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Companies
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Fill in the core details for your company.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Company Name*</FormLabel><FormControl><Input placeholder="e.g., Acme Construction" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="companyType" render={({ field }) => (<FormItem><FormLabel>Company Type</FormLabel><Select onValueChange={(value) => field.onChange(value || null)} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger></FormControl><SelectContent>{COMPANY_TYPES_OPTIONS.map(o => (<SelectItem key={o} value={o}>{o}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Brief description of the company..." {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormItem>
                  <FormLabel>Company Logo</FormLabel>
                  <FormControl><Input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} /></FormControl>
                  <FormDescription>Upload a logo for your company. Max {MAX_FILE_SIZE_MB}MB.</FormDescription>
                </FormItem>
                <Separator />
                <h3 className="text-lg font-medium">Legal & Financial Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="panNumber" render={({ field }) => (<FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="registrationNumber" render={({ field }) => (<FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="establishedYear" render={({ field }) => (<FormItem><FormLabel>Established Year</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <Separator />
                <h3 className="text-lg font-medium">Contact & Address</h3>
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address*</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input type="url" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Company</>}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}
