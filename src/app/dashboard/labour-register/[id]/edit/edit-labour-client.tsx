'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { LabourRegister, WorkOrder } from '@/types';
import { Edit, Save, Loader2, CalendarIcon, UploadCloud, ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import EditLabourRegisterLoading from './loading';

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const labourRegisterUpdateSchema = z.object({
  workerName: z.string().min(2, "Worker name is required.").max(100),
  role: z.string().min(2, "Role is required.").max(100),
  dailyWage: z.coerce.number().min(0, "Daily wage must be non-negative."),
  workOrderId: z.string().min(1, "Work Order is required."),
  medicalCertificateNumber: z.string().max(100).optional().nullable(),
  medicalCertificateExpiry: z.date().optional().nullable(),
  medicalCertificateUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5).optional().nullable(),
  nocNumber: z.string().max(100).optional().nullable(),
  nocExpiry: z.date().optional().nullable(),
  nocUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5).optional().nullable(),
  identityProofNumber: z.string().max(100).optional().nullable(),
  identityProofUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5).optional().nullable(),
  gatePassNumber: z.string().max(100).optional().nullable(),
  gatePassExpiry: z.date().optional().nullable(),
  gatePassUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5).optional().nullable(),
});

type LabourRegisterFormValues = z.infer<typeof labourRegisterUpdateSchema>;

const documentSections = [
  { title: "Medical Certificate", numberField: "medicalCertificateNumber", expiryField: "medicalCertificateExpiry", urlField: "medicalCertificateUrl" },
  { title: "NOC (No Objection Certificate)", numberField: "nocNumber", expiryField: "nocExpiry", urlField: "nocUrl" },
  { title: "Identity Proof (Aadhar/Voter Card)", numberField: "identityProofNumber", urlField: "identityProofUrl" },
  { title: "Gate Pass", numberField: "gatePassNumber", expiryField: "gatePassExpiry", urlField: "gatePassUrl" },
] as const;

export default function EditLabourRegisterPageContent({ labourerId }: { labourerId: string }) {
  const { user, dataOwnerId, isViewingOwnAccount, currentTeamMemberPermissions, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [labourer, setLabourer] = useState<LabourRegister | null>(null);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRefs = {
    medicalCertificateUrl: useRef<HTMLInputElement>(null),
    nocUrl: useRef<HTMLInputElement>(null),
    identityProofUrl: useRef<HTMLInputElement>(null),
    gatePassUrl: useRef<HTMLInputElement>(null),
  };

  const canManage = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageLabourRegister;

  const form = useForm<LabourRegisterFormValues>({
    resolver: zodResolver(labourRegisterUpdateSchema),
    defaultValues: {
      workerName: '',
      role: '',
      dailyWage: 0,
      workOrderId: '',
      medicalCertificateNumber: null,
      medicalCertificateExpiry: null,
      medicalCertificateUrl: null,
      nocNumber: null,
      nocExpiry: null,
      nocUrl: null,
      identityProofNumber: null,
      identityProofUrl: null,
      gatePassNumber: null,
      gatePassExpiry: null,
      gatePassUrl: null,
    }
  });

  useEffect(() => {
    if (!authLoading && canManage && user && dataOwnerId) {
      setIsLoading(true);
      const fetchInitialData = async () => {
        try {
          const idToken = await user.getIdToken();

          const [woResponse, labourerResponse] = await Promise.all([
            fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
            fetch(`/api/labour-register/${labourerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
          ]);

          if (!woResponse.ok) throw new Error('Failed to fetch work orders.');
          const woData: WorkOrder[] = await woResponse.json();
          setWorkOrders(woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));

          if (!labourerResponse.ok) {
            const errorData = await labourerResponse.json();
            throw new Error(errorData.error || `Failed to fetch labourer (API status ${labourerResponse.status})`);
          }
          const labourerData: LabourRegister = await labourerResponse.json();
          setLabourer(labourerData);

          const parseDate = (dateString: string | null | undefined): Date | null => {
            if (!dateString) return null;
            const date = parseISO(dateString);
            return isValid(date) ? date : null;
          };

          form.reset({
            workerName: labourerData.workerName ?? '',
            role: labourerData.role ?? '',
            dailyWage: labourerData.dailyWage ?? 0,
            workOrderId: labourerData.workOrderId ?? '',
            medicalCertificateNumber: labourerData.medicalCertificateNumber ?? null,
            medicalCertificateExpiry: parseDate(labourerData.medicalCertificateExpiry),
            medicalCertificateUrl: labourerData.medicalCertificateUrl ?? null,
            nocNumber: labourerData.nocNumber ?? null,
            nocExpiry: parseDate(labourerData.nocExpiry),
            nocUrl: labourerData.nocUrl ?? null,
            identityProofNumber: labourerData.identityProofNumber ?? null,
            identityProofUrl: labourerData.identityProofUrl ?? null,
            gatePassNumber: labourerData.gatePassNumber ?? null,
            gatePassExpiry: parseDate(labourerData.gatePassExpiry),
            gatePassUrl: labourerData.gatePassUrl ?? null,
          });

        } catch (error: any) {
          toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
          router.push('/dashboard/labour-register');
        } finally {
          setIsLoading(false);
        }
      };
      fetchInitialData();
    } else if (!authLoading && !canManage) {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManage, dataOwnerId, labourerId, user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fieldName: keyof LabourRegisterFormValues) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `File cannot exceed ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        // reader.result is string (base64) — form schema expects string | null
        form.setValue(fieldName, reader.result as string);
        toast({ title: "File Ready", description: `${file.name} will be uploaded on save.` });
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: LabourRegisterFormValues) => {
    if (!canManage) return;
    setIsSubmitting(true);

    const dataToUpdate = {
      ...values,
      medicalCertificateExpiry: values.medicalCertificateExpiry instanceof Date ? values.medicalCertificateExpiry.toISOString().split('T')[0] : null,
      nocExpiry: values.nocExpiry instanceof Date ? values.nocExpiry.toISOString().split('T')[0] : null,
      gatePassExpiry: values.gatePassExpiry instanceof Date ? values.gatePassExpiry.toISOString().split('T')[0] : null,
    };

    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/labour-register/${labourerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(dataToUpdate),
      });

      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update labourer.');
      toast({ title: "Success", description: "Labourer details updated." });
      router.push('/dashboard/labour-register');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <EditLabourRegisterLoading />;
  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to edit this record.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/labour-register">Back to Register</Link></Button>
      </div>
    );
  }
  if (!labourer) return <div className="p-4 text-center">Labourer not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Edit className="mr-3 h-7 w-7 text-primary" /> Edit Labourer
          </h1>
          <p className="text-muted-foreground">Modifying: {labourer.workerName}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/labour-register"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Labour Register</Link>
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="shadow-lg">
            <CardHeader><CardTitle>Labourer Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="workOrderId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Work Order*</FormLabel>
                    <Combobox
                      options={workOrders}
                      value={String(field.value ?? '')}
                      onChange={(val) => field.onChange(String(val))}
                      placeholder="Select Work Order..."
                      searchPlaceholder="Search..."
                      disabled={isLoading || workOrders.length === 0}
                      emptyResultText={isLoading ? "Loading..." : "No WOs."}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="workerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Worker Name*</FormLabel>
                    <FormControl>
                      <Input {...field} value={String(field.value ?? '')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role*</FormLabel>
                    <FormControl>
                      <Input {...field} value={String(field.value ?? '')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="dailyWage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Wage (₹)*</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value as number ?? 0}
                      onChange={(e) => {
                        const parsed = e.target.value === '' ? 0 : Number(e.target.value);
                        field.onChange(Number.isNaN(parsed) ? 0 : parsed);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              {documentSections.map((section, idx) => {
                const urlField = section.urlField as keyof LabourRegister;
                const currentUrl = labourer?.[urlField] as string | null | undefined;

                return (
                  <React.Fragment key={section.numberField}>
                    {idx > 0 && <Separator className="my-6" />}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-primary">{section.title}</h3>

                      <FormField
                        control={form.control}
                        name={section.numberField as keyof LabourRegisterFormValues}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{section.title} Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter document number" {...field} value={String(field.value ?? '')} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {'expiryField' in section && (
                        <FormField
                          control={form.control}
                          name={section.expiryField as keyof LabourRegisterFormValues}
                          render={({ field }) => {
                            // field.value is Date | null according to schema; be defensive
                            const value = field.value instanceof Date ? field.value : null;
                            return (
                              <FormItem className="flex flex-col">
                                <FormLabel>Expiry Date (Optional)</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {value ? format(value, "PPP") : "Pick a date"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      // selected requires Date | undefined
                                      selected={value ?? undefined}
                                      onSelect={(newDate) => {
                                        // Calendar onSelect gives Date | undefined
                                        field.onChange(newDate ?? null);
                                        form.trigger(section.expiryField as keyof LabourRegisterFormValues);
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      )}

                      <FormItem>
                        <FormLabel>Upload/Replace Document</FormLabel>
                        {currentUrl && (
                          <div className="mb-2">
                            <a
                              href={currentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={`${section.title.replace(/ /g, '_')}_${labourer.workerName.replace(/ /g, '_')}`}
                              className="text-sm text-primary hover:underline flex items-center"
                            >
                              <ExternalLink className="mr-1 h-4 w-4" /> View Current Document
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input
                              type="file"
                              ref={fileInputRefs[section.urlField as keyof typeof fileInputRefs]}
                              onChange={(e) => handleFileChange(e, section.urlField as keyof LabourRegisterFormValues)}
                              className="flex-1"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => fileInputRefs[section.urlField as keyof typeof fileInputRefs].current?.click()}
                          >
                            <UploadCloud className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormDescription>Max {MAX_FILE_SIZE_MB}MB.</FormDescription>
                        <FormField control={form.control} name={section.urlField as keyof LabourRegisterFormValues} render={() => <FormMessage />} />
                      </FormItem>
                    </div>
                  </React.Fragment>
                );
              })}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : <><Save className="mr-2 h-4 w-4" /> Update Labourer</>}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
