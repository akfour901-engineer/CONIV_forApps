
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Company, TeamPermissions } from '@/types/server-only';
import { Building2, Save, ArrowLeft, Loader2, UploadCloud, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CompanyDetailLoadingSkeleton from '@/app/dashboard/companies/[id]/loading';

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
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

const ROLES_OPTIONS = ['Owner', 'Director', 'Manager', 'Accountant', 'Employee', 'Consultant', 'Other'];
const COMPANY_TYPES_OPTIONS = ['Proprietorship', 'Partnership', 'Private Limited Company', 'Public Limited Company', 'Limited Liability Partnership (LLP)', 'One Person Company (OPC)', 'Section 8 Company (NPO)', 'Sole Proprietorship', 'Joint Venture', 'Other'];

interface CompanyDetailClientPageProps {
  companyId: string;
  startInEditMode?: boolean;
}

export default function CompanyDetailClientPage({ companyId, startInEditMode = false }: CompanyDetailClientPageProps) {
  const { user, userProfile, loading: authLoading, dataOwnerId, isViewingOwnAccount, currentTeamMemberPermissions } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(startInEditMode);

  const canManageCompany = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageCompanies;

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
  });

  useEffect(() => {
    if (authLoading || !user || !dataOwnerId) {
      if (!authLoading && !user) router.push('/auth/signin');
      return;
    }
    
    const fetchCompany = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/companies/${companyId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 403 || response.status === 404) {
            toast({ title: errorData.error || (response.status === 404 ? "Not Found" : "Access Denied"), description: response.status === 404 ? "Company not found." : "You do not have permission to view this company.", variant: "destructive" });
            router.push('/dashboard/companies');
          } else {
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
          }
          setCompany(null);
          setIsLoading(false);
          return;
        }

        const fetchedCompanyData: Company = await response.json();
        setCompany(fetchedCompanyData);
        form.reset({
          name: fetchedCompanyData.name || "",
          companyType: fetchedCompanyData.companyType ?? "",
          description: fetchedCompanyData.description ?? "",
          logoUrl: fetchedCompanyData.logoUrl ?? "",
          gstin: fetchedCompanyData.gstin ?? "",
          panNumber: fetchedCompanyData.panNumber ?? "",
          registrationNumber: fetchedCompanyData.registrationNumber ?? "",
          establishedYear: fetchedCompanyData.establishedYear ?? null,
          address: fetchedCompanyData.address || "",
          website: fetchedCompanyData.website ?? "",
          contactPerson: fetchedCompanyData.contactPerson ?? "",
          contactEmail: fetchedCompanyData.contactEmail ?? "",
          contactPhone: fetchedCompanyData.contactPhone ?? "",
          role: fetchedCompanyData.role ?? "",
        });
      } catch (error: any) {
        console.error("Error fetching company via API:", error);
        toast({ title: "Error", description: "Failed to fetch company details.", variant: "destructive" });
        setCompany(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCompany();
  }, [companyId, user, dataOwnerId, authLoading, router, toast, form]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Logo file cannot exceed ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (logoInputRef.current) logoInputRef.current.value = "";
        form.setValue('logoUrl', company?.logoUrl ?? null);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('logoUrl', reader.result as string, { shouldValidate: true });
        toast({ title: "Logo Ready", description: "Logo will be updated upon saving." });
      };
      reader.onerror = () => toast({ title: "File Read Error", variant: "destructive" });
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: CompanyFormValues) => {
    if (!user || !companyId || !dataOwnerId || !company || !userProfile) {
      toast({ title: "Error", description: "Required information missing.", variant: "destructive"});
      return;
    }
    if (!canManageCompany) {
        toast({ title: "Permission Denied", description: "You do not have permission to edit this company.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update company.');
      }
      
      const updatedCompanyData: Company = await response.json();
      toast({ title: "Success", description: "Company details updated." });
      setIsEditing(false);
      setCompany(updatedCompanyData); 
      form.reset(updatedCompanyData);
      router.push('/dashboard/companies');

    } catch (error: any) {
      console.error("Error updating company via API:", error);
      toast({ title: "Error", description: `Failed to update company: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEditToggle = () => {
    if (canManageCompany) {
      setIsEditing(!isEditing);
      if (!isEditing && company) { 
        form.reset({
            name: company.name || "", 
            companyType: company.companyType ?? "", 
            description: company.description ?? "",
            logoUrl: company.logoUrl ?? "", 
            gstin: company.gstin ?? "", 
            panNumber: company.panNumber ?? "",
            registrationNumber: company.registrationNumber ?? "", 
            establishedYear: company.establishedYear ?? null,
            address: company.address || "", 
            website: company.website ?? "", 
            contactPerson: company.contactPerson ?? "", 
            contactEmail: company.contactEmail ?? "",
            contactPhone: company.contactPhone ?? "", 
            role: company.role ?? "",
        });
      }
    } else {
      toast({title: "Permission Denied", description: "You cannot edit this company.", variant: "destructive"});
    }
  };

  if (isLoading || authLoading) return <CompanyDetailLoadingSkeleton />;
  if (!user || !userProfile || !dataOwnerId) return <CompanyDetailLoadingSkeleton />;
  
  if (!company && !isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Not Found or Access Denied</h2>
            <p className="text-muted-foreground">The requested company could not be found or you do not have permission to view it.</p>
            <Button asChild className="mt-6"><Link href="/dashboard/companies">Back to Companies</Link></Button>
        </div>
    );
  }

  const logoPreview = form.watch('logoUrl');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            {isEditing ? <Edit className="mr-3 h-7 w-7 text-primary" /> : <Building2 className="mr-3 h-7 w-7 text-primary" />}
            {isEditing ? 'Edit Company' : 'Company Details'}
          </h1>
          <p className="text-muted-foreground">{isEditing ? `Modifying: ${company?.name}` : `Viewing: ${company?.name}`}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" asChild>
                <Link href="/dashboard/companies"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Companies</Link>
            </Button>
            {canManageCompany && (
                <Button onClick={handleEditToggle} variant={isEditing ? "secondary" : "default"}>
                    <Edit className="mr-2 h-4 w-4" /> {isEditing ? "Cancel Edit" : "Edit Company"}
                </Button>
            )}
        </div>
      </div>
      <Card className="shadow-lg">
         <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
             <CardHeader className="flex flex-col sm:flex-row items-start gap-4">
                <Image 
                  src={logoPreview || 'https://placehold.co/100x100.png'} 
                  alt={`${form.getValues('name')} logo`} 
                  width={100} 
                  height={100} 
                  className="rounded-md border object-cover aspect-square" 
                  data-ai-hint="company logo" 
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/100x100.png`; }} 
                />
                <div className="flex-1"> 
                  <CardTitle className="text-2xl">{form.getValues('name')}</CardTitle> 
                  <CardDescription>{form.getValues('companyType')}</CardDescription> 
                  <CardDescription>GSTIN: {form.getValues('gstin') || 'N/A'}</CardDescription> 
                  <CardDescription>PAN: {form.getValues('panNumber') || 'N/A'}</CardDescription> 
                  <CardDescription>Last Updated: {company?.updatedAt ? new Date(company.updatedAt).toLocaleString() : 'N/A'} by {company?.updatedByName || 'N/A'}</CardDescription> 
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Company Name*</FormLabel><FormControl><Input {...field} readOnly={!isEditing} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="companyType" render={({ field }) => (<FormItem><FormLabel>Company Type</FormLabel><Select onValueChange={(value) => field.onChange(value || null)} value={field.value || ""} disabled={!isEditing}><FormControl><SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger></FormControl><SelectContent>{COMPANY_TYPES_OPTIONS.map(o => (<SelectItem key={o} value={o}>{o}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                {isEditing && (
                    <FormItem>
                        <FormLabel>Upload Logo</FormLabel>
                        <FormControl><Input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} /></FormControl>
                        <FormDescription>Max {MAX_FILE_SIZE_MB}MB. A new logo will replace the current one.</FormDescription>
                    </FormItem>
                )}
                <Separator />
                <h3 className="text-lg font-medium">Legal & Financial Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="panNumber" render={({ field }) => (<FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="registrationNumber" render={({ field }) => (<FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="establishedYear" render={({ field }) => (<FormItem><FormLabel>Established Year</FormLabel><FormControl><Input type="number" {...field} readOnly={!isEditing} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <Separator />
                <h3 className="text-lg font-medium">Contact & Address</h3>
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address*</FormLabel><FormControl><Textarea {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input type="url" {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" {...field} readOnly={!isEditing} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </CardContent>
            {isEditing && (
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                </Button>
              </CardFooter>
            )}
          </form>
        </Form>
      </Card>
    </div>
  );
}
