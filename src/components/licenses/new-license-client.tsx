
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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { License, Company } from '@/types';
import { LICENSE_TYPES_OPTIONS, LICENSE_CREATION_COST } from '@/lib/constants';
import { PlusCircle, Save, Loader2, CalendarIcon, UploadCloud, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import NewLicenseLoadingSkeleton from '@/app/dashboard/licenses/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
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

export default function NewLicenseClient() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const documentFileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canManageLicenses = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageOwnerLicenses;

  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
      licenseName: "", licenseNumber: "", licenseType: "Trade License", issuingAuthority: "",
      issueDate: new Date(), expiryDate: new Date(), companyId: null, documentUrl: null, notes: ""
    },
  });

  useEffect(() => {
    if (user && dataOwnerId) {
      const fetchCompanies = async () => {
        setIsLoadingCompanies(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error('Failed to fetch companies.');
          const companiesData: Company[] = await response.json();
          setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name })));
        } catch (error) {
          console.error("Error fetching companies:", error);
        } finally {
          setIsLoadingCompanies(false);
        }
      };
      fetchCompanies();
    }
  }, [user, dataOwnerId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (documentFileRef.current) documentFileRef.current.value = "";
        form.setValue("documentUrl", null); setSelectedFileName(null); return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("documentUrl", reader.result as string, { shouldValidate: true });
        setSelectedFileName(file.name);
        toast({ title: "Document Selected", description: `${file.name} ready.` });
      };
      reader.onerror = () => { toast({ title: "File Read Error", variant: "destructive" }); };
      reader.readAsDataURL(file);
    } else { setSelectedFileName(null); }
  };

  const onSubmit = async (values: LicenseFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", variant: "destructive" }); return;
    }
    if (!canManageLicenses) {
      toast({ title: "Permission Denied", variant: "destructive" }); return;
    }
    const cost = appConfig?.actionCosts?.find(c => c.key === 'LICENSE_CREATION_COST')?.cost ?? LICENSE_CREATION_COST;
    if ((userProfile.resourcePoints ?? 0) < cost) {
      setPointsInfo({ required: cost, current: userProfile.resourcePoints ?? 0 });
      setIsPointsDialogOpen(true);
      return;
    }
    setIsSubmitting(true);
    setGlobalIsLoading(true);
    const licenseDataToSave = { ...values, dataOwnerId, issueDate: format(values.issueDate, 'yyyy-MM-dd'), expiryDate: format(values.expiryDate, 'yyyy-MM-dd') };

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(licenseDataToSave),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || 'Failed to create license.');
        }
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
      }
      
      const createdResult: License & { newResourcePoints?: number; cost?: number } = await response.json();
      if (updateGlobalUserProfile && userProfile && createdResult.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: createdResult.newResourcePoints }});
      }
      toast({ title: "Success", description: "License created successfully." });
      router.push('/dashboard/licenses');
    } catch (error: any) {
      toast({ title: "Error Creating License", description: error.message, variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) return <NewLicenseLoadingSkeleton />;
  if (!canManageLicenses) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to add new licenses.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/licenses">Back to Licenses</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold flex items-center"><PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New License</h1><p className="text-muted-foreground">Enter details for a new business or professional license.</p></div>
          <Button variant="outline" asChild><Link href="/dashboard/licenses"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Licenses</Link></Button>
        </div>
        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader><CardTitle>License Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="licenseName" render={({ field }) => (<FormItem><FormLabel>License Name*</FormLabel><FormControl><Input placeholder="e.g., Building Contractor License" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="licenseNumber" render={({ field }) => (<FormItem><FormLabel>License Number*</FormLabel><FormControl><Input placeholder="Enter license number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="licenseType" render={({ field }) => (<FormItem><FormLabel>License Type*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{LICENSE_TYPES_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="issuingAuthority" render={({ field }) => (<FormItem><FormLabel>Issuing Authority*</FormLabel><FormControl><Input placeholder="e.g., Municipal Corporation" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="issueDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Issue Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value,"PPP"):"Pick a date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="expiryDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Expiry Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value,"PPP"):"Pick a date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => form.getValues('issueDate') ? d < form.getValues('issueDate')! : false} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="companyId" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Link to Company (Optional)</FormLabel><Combobox options={companies} value={field.value || ""} onChange={(val) => field.onChange(val === "" ? null : val)} placeholder="Select company..." searchPlaceholder="Search..." disabled={isLoadingCompanies} /><FormMessage /></FormItem>)} />
                <FormItem>
                  <FormLabel htmlFor="docUpload">Upload Document (Optional)</FormLabel>
                  <div className="flex items-center space-x-2"><FormControl><Input id="docUpload" type="file" ref={documentFileRef} onChange={handleFileChange} className="flex-1" /></FormControl><Button type="button" variant="outline" onClick={() => documentFileRef.current?.click()} className="shrink-0"><UploadCloud className="mr-2 h-4 w-4" />Choose</Button></div>
                  <FormDescription>Max {MAX_FILE_SIZE_MB}MB. {selectedFileName && <span className="text-green-600 block mt-1">Selected: {selectedFileName}</span>}</FormDescription>
                </FormItem>
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
              <CardFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save License</>}</Button></CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}
