'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, LabourRegister, LabourAdvance, TeamPermissions } from '@/types';
import { HandCoins, Save, Loader2, CalendarIcon, UploadCloud, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const labourAdvanceFormSchema = z.object({
  workOrderId: z.string().min(1, "Work Order ID is required."),
  labourRegisterId: z.string().min(1, "Labourer ID is required."),
  date: z.date({ required_error: "Payment date is required." }),
  amount: z.coerce.number().positive("Amount must be a positive number."),
  description: z.string().max(500).optional().nullable(),
  documentUrl: z.string().optional().nullable(),
});

type LabourAdvanceFormValues = z.infer<typeof labourAdvanceFormSchema>;

function NewLabourAdvancePageContent() {
  const { user, dataOwnerId, isViewingOwnAccount, currentTeamMemberPermissions, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(true);
  const [labourers, setLabourers] = useState<ComboboxOption[]>([]);
  const [isLoadingLabourers, setIsLoadingLabourers] = useState(false);
  const proofDocumentFileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const canManagePayments = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageLabourPayments;

  const form = useForm<LabourAdvanceFormValues>({
    resolver: zodResolver(labourAdvanceFormSchema),
    defaultValues: { workOrderId: "", labourRegisterId: "", date: new Date(), amount: 0, description: "", documentUrl: "" },
  });

  const selectedWorkOrderId = form.watch("workOrderId");

  useEffect(() => {
    if (user && dataOwnerId) {
      setIsLoadingWorkOrders(true);
      const fetchWorkOrders = async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
          if (!response.ok) throw new Error('Failed to fetch work orders');
          const woData: WorkOrder[] = await response.json();
          setWorkOrders(woData.map(data => ({ value: data.id!, label: `${data.workOrderNumber} - ${data.organizationName}`, data })));
        } catch (error) { toast({ title: "Error", variant: "destructive" }); }
        finally { setIsLoadingWorkOrders(false); }
      };
      fetchWorkOrders();
    }
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (user && dataOwnerId && selectedWorkOrderId) {
      setIsLoadingLabourers(true);
      form.setValue('labourRegisterId', ''); setLabourers([]);
      const fetchLabourersForWO = async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/labour-register?dataOwnerId=${dataOwnerId}&workOrderId=${selectedWorkOrderId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
          if(!response.ok) throw new Error("Failed to fetch labourers");
          const filteredLabourers: LabourRegister[] = await response.json();
          setLabourers(filteredLabourers.map(data => ({ value: data.id!, label: `${data.workerName} (${data.role}) - Wage: ${data.dailyWage}`, data })));
        } catch (error) { toast({ title: "Error", variant: "destructive" }); }
        finally { setIsLoadingLabourers(false); }
      };
      fetchLabourersForWO();
    } else { setLabourers([]); }
  }, [user, dataOwnerId, selectedWorkOrderId, toast, form]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (proofDocumentFileRef.current) proofDocumentFileRef.current.value = "";
        form.setValue("documentUrl", ""); setSelectedFileName(null);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("documentUrl", reader.result as string, { shouldValidate: true });
        setSelectedFileName(file.name);
        toast({ title: "Document Selected", description: `${file.name} ready.` });
      };
      reader.onerror = () => { toast({ title: "File Read Error", variant: "destructive" }); form.setValue("documentUrl", ""); setSelectedFileName(null); };
      reader.readAsDataURL(file);
    } else { form.setValue("documentUrl", ""); setSelectedFileName(null); }
  };

  const onSubmit = async (values: LabourAdvanceFormValues) => {
    if (!user) { toast({ title: "Authentication Error", variant: "destructive" }); return; }
    if (!canManagePayments) { toast({ title: "Permission Denied", variant: "destructive" }); return; }

    setIsSubmitting(true);
    const advanceDataForApi = { 
      ...values, 
      date: format(values.date, 'yyyy-MM-dd'),
      dataOwnerId: dataOwnerId, // This was missing
    };

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/labour-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(advanceDataForApi),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      toast({ title: "Success", description: "Advance/Payment recorded successfully." });
      form.reset(); setSelectedFileName(null);
      if(proofDocumentFileRef.current) proofDocumentFileRef.current.value = "";
      form.setValue('workOrderId', ''); form.setValue('labourRegisterId', '');
    } catch (error: any) {
      console.error("Error recording advance/payment:", error);
      toast({ title: "Error", description: error.message || "Failed to record transaction.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authLoading) return <NewLabourAdvancePageSkeleton />;
  if (!canManagePayments) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"> <AlertTriangle className="w-16 h-16 text-destructive mb-4" /> <h2 className="text-xl font-semibold">Permission Denied</h2> <p className="text-muted-foreground">You do not have permission to manage labour payments.</p> <Button asChild className="mt-6"><Link href="/dashboard/labour-register">Back</Link></Button> </div> );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <HandCoins className="mr-3 h-7 w-7 text-primary" /> Record Labour Advance/Payment
          </h1>
          <p className="text-muted-foreground">Log payments or advances made to labourers.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/labour-register"> <ArrowLeft className="mr-2 h-4 w-4"/> Back to Labour Register</Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader><CardTitle>Transaction Details</CardTitle><CardDescription>Select Work Order, Labourer, and enter payment details.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="workOrderId" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Work Order*</FormLabel><Combobox options={workOrders} value={field.value} onChange={field.onChange} placeholder="Select Work Order..." searchPlaceholder="Search..." disabled={isLoadingWorkOrders || workOrders.length === 0} emptyResultText={isLoadingWorkOrders ? "Loading..." : "No WOs."}/><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="labourRegisterId" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Labourer*</FormLabel><Combobox options={labourers} value={field.value} onChange={field.onChange} placeholder="Select Labourer..." searchPlaceholder="Search..." disabled={!selectedWorkOrderId || isLoadingLabourers || labourers.length === 0} emptyResultText={isLoadingLabourers ? "Loading..." : (selectedWorkOrderId ? "No labourers for this WO." : "Select a Work Order.")}/><FormMessage /></FormItem> )} />
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Payment Date*</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><span><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</span></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Amount (₹)*</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description / Remarks (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Advance for personal expense, Salary for June" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
              <FormItem>
                <FormLabel htmlFor="proofDocumentUpload">Upload Proof Document (Optional)</FormLabel>
                <div className="flex items-center space-x-2">
                  <FormControl><Input id="proofDocumentUpload" type="file" accept="image/*,application/pdf" ref={proofDocumentFileRef} onChange={handleFileChange} className="flex-grow" /></FormControl>
                  <Button type="button" variant="outline" onClick={() => proofDocumentFileRef.current?.click()} className="shrink-0"><UploadCloud className="mr-2 h-4 w-4" /> Choose File</Button>
                </div>
                <FormDescription>Max file size: {MAX_FILE_SIZE_MB}MB. {selectedFileName && <span className="text-green-600">Selected: {selectedFileName}</span>}</FormDescription>
              </FormItem>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting || isLoadingWorkOrders || isLoadingLabourers}>
                {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> ) : ( <><Save className="mr-2 h-4 w-4" /> Save Transaction</> )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

function NewLabourAdvancePageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-1/2" /> <Skeleton className="h-4 w-1/3" />
            <Card className="shadow-lg">
                <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
                <CardContent className="space-y-6">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </CardContent>
                <CardFooter><Skeleton className="h-10 w-28" /></CardFooter>
            </Card>
        </div>
    )
}

function NewLabourAdvancePageWrapper() {
  return ( <Suspense fallback={<NewLabourAdvancePageSkeleton />}> <NewLabourAdvancePageContent /> </Suspense> );
}
export default NewLabourAdvancePageWrapper;