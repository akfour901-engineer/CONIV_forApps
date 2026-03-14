
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { License, Company, LicenseType } from '@/types';
import { LICENSE_TYPES_OPTIONS } from '@/types/server-only';
import { Edit, Save, Loader2, CalendarIcon, UploadCloud, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import EditLicenseLoadingSkeleton from './loading';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';

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

export default function EditLicenseClient({ licenseId }: { licenseId: string }) {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [license, setLicense] = useState<License | null>(null);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const docFileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const canManageLicenses = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOwnerLicenses;

  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (!authLoading && user && dataOwnerId && canManageLicenses) {
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
          }

          if (licenseResponse.ok) {
            const data: License = await licenseResponse.json();
            setLicense(data);
            form.reset({
              ...data,
              issueDate: data.issueDate ? parseISO(data.issueDate) : undefined,
              expiryDate: data.expiryDate ? parseISO(data.expiryDate) : undefined,
            });
            if(data.documentUrl) setSelectedFileName("An existing document is attached.");
          } else {
             const errorData = await licenseResponse.json();
             throw new Error(errorData.error || 'Failed to fetch license details.');
          }
        } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
          router.push('/dashboard/licenses');
        } finally {
          setIsLoading(false);
        }
      };
      fetchInitialData();
    } else if (!authLoading && !canManageLicenses) {
        setIsLoading(false);
    }
  }, [authLoading, canManageLicenses, dataOwnerId, form, licenseId, router, toast, user]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `File cannot exceed ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (docFileRef.current) docFileRef.current.value = "";
        form.setValue("documentUrl", license?.documentUrl || null);
        setSelectedFileName(null);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("documentUrl", reader.result as string);
        setSelectedFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: LicenseFormValues) => {
    if (!user || !canManageLicenses) return;
    setIsSubmitting(true);
    const dataToSave = {
        ...values,
        issueDate: format(values.issueDate, 'yyyy-MM-dd'),
        expiryDate: format(values.expiryDate, 'yyyy-MM-dd'),
    };
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/licenses/${licenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(dataToSave),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update license.');
      toast({ title: "Success", description: "License updated successfully." });
      router.push('/dashboard/licenses');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
        <Button asChild className="mt-6"><Link href="/dashboard/licenses">Back to Licenses</Link></Button>
      </div>
    );
  }
  if(!license) return <div className="text-center p-4">License not found or access denied.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center"><Edit className="mr-3 h-7 w-7 text-primary" /> Edit License</h1>
          <p className="text-muted-foreground">Modifying: {license.licenseName}</p>
        </div>
        <Button variant="outline" asChild><Link href="/dashboard/licenses"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Licenses</Link></Button>
      </div>
      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader><CardTitle>License Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="licenseName" render={({ field }) => (<FormItem><FormLabel>License Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="licenseNumber" render={({ field }) => (<FormItem><FormLabel>License Number*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="licenseType" render={({ field }) => (<FormItem><FormLabel>License Type*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{LICENSE_TYPES_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="issuingAuthority" render={({ field }) => (<FormItem><FormLabel>Issuing Authority*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Issue Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn(!field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : "Pick date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Expiry Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn(!field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : "Pick date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => form.getValues('issueDate') ? d < form.getValues('issueDate') : false}/></PopoverContent></Popover><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem><FormLabel>Link to Company (Optional)</FormLabel><Combobox options={companies} value={field.value || ""} onChange={(val) => field.onChange(val === "" ? null : val)} placeholder="Select company..." searchPlaceholder="Search..." disabled={isLoading}/><FormMessage /></FormItem>)} />
              <FormItem>
                <FormLabel htmlFor="docUpload">Upload/Replace Document</FormLabel>
                <div className="flex items-center space-x-2">
                  <FormControl>
                    <Input id="docUpload" type="file" ref={docFileRef} onChange={handleFileChange} />
                  </FormControl>
                  <Button type="button" variant="outline" onClick={() => docFileRef.current?.click()}><UploadCloud className="mr-2 h-4 w-4"/>Choose File</Button>
                </div>
                <FormDescription>Max file size: {MAX_FILE_SIZE_MB}MB. {selectedFileName && <span className="text-green-600 block mt-1">Selected: {selectedFileName}</span>}</FormDescription>
              </FormItem>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value || ""} rows={4} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Updating...</> : <><Save className="mr-2 h-4 w-4"/>Update License</>}</Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
