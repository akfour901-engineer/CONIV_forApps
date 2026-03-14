
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { License, Company, TeamPermissions } from '@/types';
import { LICENSE_TYPES_OPTIONS } from '@/lib/constants';
import { Edit, Save, Loader2, CalendarIcon, UploadCloud, ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import EditLicenseLoadingSkeleton from '@/app/dashboard/licenses/[id]/edit/loading';
import { useLoading } from '@/contexts/loading-context';

const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const licenseFormSchema = z.object({
  licenseName: z.string().min(1, "License name is required.").max(255),
  licenseNumber: z.string().min(1, "License number is required.").max(100),
  licenseType: z.string().refine(val => LICENSE_TYPES_OPTIONS.includes(val as typeof LICENSE_TYPES_OPTIONS[number]), { message: "Invalid license type." }),
  issuingAuthority: z.string().min(1, "Issuing authority is required.").max(255),
  issueDate: z.date({ required_error: "Issue date is required." }),
  expiryDate: z.date({ required_error: "Expiry date is required." }),
  companyId: z.string().optional().nullable(),
  documentUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Document is too large.").optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).refine(data => data.expiryDate >= data.issueDate, {
  message: "Expiry date cannot be before issue date.",
  path: ["expiryDate"],
});

type LicenseFormValues = z.infer<typeof licenseFormSchema>;

interface EditLicenseClientProps {
  licenseId: string;
}

export default function EditLicenseClient({ licenseId }: EditLicenseClientProps) {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [license, setLicense] = useState<License | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const documentFileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const canManageLicenses = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOwnerLicenses;

  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
  });

  useEffect(() => {
    if (!authLoading && user && dataOwnerId) {
        setIsLoading(true);
        const fetchInitialData = async () => {
            try {
                const idToken = await user.getIdToken();
                const [companiesResponse, licenseResponse] = await Promise.all([
                    fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                    fetch(`/api/licenses/${licenseId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
                ]);
                
                if (companiesResponse.ok) {
                    const companiesData: Company[] = await companiesResponse.json();
                    setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name })));
                } else {
                    console.warn("Could not fetch companies.");
                }
                
                if (!licenseResponse.ok) {
                    const errorData = await licenseResponse.json();
                    throw new Error(errorData.error || `Failed to fetch license details`);
                }
                const data: License = await licenseResponse.json();
                
                if(data.userId !== dataOwnerId) {
                    toast({ title: "Access Denied", variant: "destructive" });
                    router.push('/dashboard/licenses');
                    return;
                }

                setLicense(data);
                form.reset({
                    ...data,
                    issueDate: data.issueDate ? parseISO(data.issueDate) : undefined,
                    expiryDate: data.expiryDate ? parseISO(data.expiryDate) : undefined,
                });
                if (data.documentUrl) setSelectedFileName("Existing document attached.");

            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                router.push('/dashboard/licenses');
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }
  }, [licenseId, user, dataOwnerId, authLoading, router, toast, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", variant: "destructive" });
        if (documentFileRef.current) documentFileRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("documentUrl", reader.result as string, { shouldValidate: true });
        setSelectedFileName(file.name);
        toast({ title: "Document Ready", description: "File will be updated upon saving." });
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: LicenseFormValues) => {
    if (!canManageLicenses) {
      toast({ title: "Permission Denied", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const dataToUpdate = {
        ...values,
        issueDate: format(values.issueDate, 'yyyy-MM-dd'),
        expiryDate: format(values.expiryDate, 'yyyy-MM-dd'),
    };
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/licenses/${licenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(dataToUpdate),
      });

      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update license.');
      toast({ title: "Success", description: "License updated successfully." });
      router.push('/dashboard/licenses');
    } catch (error: any) {
      toast({ title: "Error Updating License", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <EditLicenseLoadingSkeleton />;

  if (!canManageLicenses) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to edit licenses.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/licenses">Back to Licenses</Link>
        </Button>
      </div>
    );
  }

  if (!license) return <div className="text-center p-4">License not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold flex items-center"><Edit className="mr-3 h-7 w-7 text-primary" /> Edit License</h1><p className="text-muted-foreground">Modifying license: {license.licenseName}</p></div>
        <Button variant="outline" asChild><Link href="/dashboard/licenses"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Link></Button>
      </div>
      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader><CardTitle>License Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="licenseName" render={({ field }) => (<FormItem><FormLabel>License Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="licenseNumber" render={({ field }) => (<FormItem><FormLabel>License Number*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="licenseType" render={({ field }) => (<FormItem><FormLabel>License Type*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{LICENSE_TYPES_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="issuingAuthority" render={({ field }) => (<FormItem><FormLabel>Issuing Authority*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Issue Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value,"PPP"):"Pick a date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Expiry Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value,"PPP"):"Pick a date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Link to Company (Optional)</FormLabel><Combobox options={companies} value={field.value || ""} onChange={(val) => field.onChange(val === "" ? null : val)} placeholder="Select company..." searchPlaceholder="Search..." disabled={isLoadingCompanies} /><FormMessage /></FormItem>)} />
              <FormItem>
                <FormLabel>Upload/Replace Document</FormLabel>
                {license.documentUrl && <div className="mb-1"><a href={license.documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center"><ExternalLink className="mr-1 h-4 w-4" /> View Current Document</a></div>}
                <div className="flex items-center space-x-2"><FormControl><Input type="file" ref={documentFileRef} onChange={handleFileChange} className="flex-1"/></FormControl><Button type="button" variant="outline" onClick={() => documentFileRef.current?.click()} className="shrink-0"><UploadCloud className="mr-2 h-4 w-4" />Choose File</Button></div>
                {selectedFileName && <FormDescription>Selected: {selectedFileName}</FormDescription>}
              </FormItem>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
            <CardFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Updating...</> : <><Save className="mr-2 h-4 w-4"/> Update License</>}</Button></CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

