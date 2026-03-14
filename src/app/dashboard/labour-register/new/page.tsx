
'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, LabourRegister } from '@/types';
import { PlusCircle, Save, Loader2, ArrowLeft, CalendarIcon, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import NewLabourRegisterPageSkeleton from './loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { LABOUR_ENTRY_CREATION_COST } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const LABOUR_ROLE_SUGGESTIONS = [
  'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Painter', 'Welder', 'Rigger',
  'Scaffolder', 'Foreman', 'Supervisor', 'Helper', 'Labourer', 'Driver',
  'Operator (Crane)', 'Operator (Excavator)', 'Technician', 'HVAC Technician',
  'Surveyor', 'Safety Officer', 'Site Engineer', 'Fitter', 'Grinder', 'Insulator',
  'Bar Bender', 'Accountant', 'Store Keeper', 'Security Guard'
];

const labourRegisterFormSchema = z.object({
  workerName: z.string().min(2, "Worker name is required.").max(100),
  role: z.string().min(2, "Role is required.").max(100),
  dailyWage: z.coerce.number().min(0, "Daily wage must be non-negative."),
  workOrderId: z.string().min(1, "Work Order is required."),
  medicalCertificateNumber: z.string().max(100).optional().nullable(),
  medicalCertificateExpiry: z.date().optional().nullable(),
  nocNumber: z.string().max(100).optional().nullable(),
  nocExpiry: z.date().optional().nullable(),
  identityProofNumber: z.string().max(100).optional().nullable(),
  gatePassNumber: z.string().max(100).optional().nullable(),
  gatePassExpiry: z.date().optional().nullable(),
});

type LabourRegisterFormValues = z.infer<typeof labourRegisterFormSchema>;

function NewLabourRegisterPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const workOrderIdFromParamsRef = useRef<string | null>(null);

  const canManageLabour = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageLabourRegister;
  
  const form = useForm<LabourRegisterFormValues>({
    resolver: zodResolver(labourRegisterFormSchema),
    defaultValues: {
      workerName: "",
      role: "",
      dailyWage: 0,
      workOrderId: "",
    },
  });

  useEffect(() => {
    workOrderIdFromParamsRef.current = searchParams?.get('workOrderId') ?? null;
  }, [searchParams]);

  useEffect(() => {
    if (user && dataOwnerId) {
      const fetchWorkOrders = async () => {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch work orders via API.');
          }
          const woData: WorkOrder[] = await response.json();
          const woOptions = woData.map(data => ({
            value: data.id!,
            label: `${data.workOrderNumber} - ${data.organizationName} (Scope: ${data.scopeOfWork?.substring(0,30) || 'N/A'}...)`,
            data
          }));
          setWorkOrders(woOptions);

          if (workOrderIdFromParamsRef.current && woOptions.some(opt => opt.value === workOrderIdFromParamsRef.current)) {
            form.setValue('workOrderId', workOrderIdFromParamsRef.current, { shouldValidate: true });
          }
        } catch (error: any) {
          console.error("Error fetching work orders (from API):", error);
          toast({ title: "Error", description: error.message || "Could not load work orders.", variant: "destructive" });
        }
        setIsLoading(false);
      };
      fetchWorkOrders();
    }
  }, [user, dataOwnerId, toast, form]);

  const onSubmit = async (values: LabourRegisterFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canManageLabour) {
        toast({ title: "Permission Denied", description: "You do not have permission to add labourers.", variant: "destructive" });
        return;
    }
    
    const cost = appConfig.actionCosts?.find(c => c.key === 'LABOUR_ENTRY_CREATION_COST')?.cost ?? LABOUR_ENTRY_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
    }

    setIsSubmitting(true);
    
    const dataToSave = {
      ...values,
      medicalCertificateExpiry: values.medicalCertificateExpiry ? format(values.medicalCertificateExpiry, 'yyyy-MM-dd') : null,
      nocExpiry: values.nocExpiry ? format(values.nocExpiry, 'yyyy-MM-dd') : null,
      gatePassExpiry: values.gatePassExpiry ? format(values.gatePassExpiry, 'yyyy-MM-dd') : null,
      dataOwnerId: dataOwnerId,
    };

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/labour-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(dataToSave),
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
      
      const createdLabourer: LabourRegister & { newResourcePoints?: number, cost?: number } = await response.json();
      
      if (updateGlobalUserProfile && userProfile && createdLabourer.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        const updatedProfile = { ...userProfile, resourcePoints: createdLabourer.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() };
        updateGlobalUserProfile({ userProfile: updatedProfile, teamMemberPermissions: currentTeamMemberPermissions, teamOwnerProfileData: null });
      }
      
      toast({ title: "Success", description: `${values.workerName} added to labour register. Cost: ${createdLabourer.cost || 0} points.` });
      router.push('/dashboard/labour-register');
    } catch (error: any) {
      console.error("Error adding labourer via API: ", error);
      toast({ title: "Error Adding Labourer", description: error.message || "Failed to add labourer.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
     return <NewLabourRegisterPageSkeleton />;
  }
  if (!user || !userProfile) {
    router.push('/auth/signin');
    return <NewLabourRegisterPageSkeleton />; 
  }
  if (!canManageLabour) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage the labour register.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/labour-register">Back to Labour Register</Link>
        </Button>
      </div>
    );
  }

  const documentSections = [
    { title: "Medical Certificate", numberField: "medicalCertificateNumber", expiryField: "medicalCertificateExpiry" },
    { title: "NOC (No Objection Certificate)", numberField: "nocNumber", expiryField: "nocExpiry" },
    { title: "Identity Proof (Aadhar/Voter Card)", numberField: "identityProofNumber" },
    { title: "Gate Pass", numberField: "gatePassNumber", expiryField: "gatePassExpiry" },
  ] as const;


  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New Labourer
            </h1>
            <p className="text-muted-foreground">Enter details and link to a Work Order.</p>
          </div>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/labour-register">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Labour Register
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Labourer Information</CardTitle>
                <CardDescription>Fill in worker`s details and associate them with a project.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="workOrderId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Link to Work Order*</FormLabel>
                      <Combobox
                        options={workOrders}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Work Order..."
                        searchPlaceholder="Search Work Orders..."
                        disabled={isLoading || workOrders.length === 0}
                        emptyResultText={isLoading ? "Loading..." : "No active work orders found."}
                      />
                      {workOrders.length === 0 && !isLoading && (
                        <p className="text-xs text-muted-foreground pt-1">
                          No Work Orders found. <Link href="/dashboard/work-orders/new" className="underline">Create a Work Order</Link> first.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="workerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Worker Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Ramesh Kumar" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role / Skill*</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Mason, Helper, Electrician" 
                            {...field} 
                            list="labourRolesDatalist"
                          />
                        </FormControl>
                        <datalist id="labourRolesDatalist">
                          {LABOUR_ROLE_SUGGESTIONS.map(role => (
                            <option key={role} value={role} />
                          ))}
                        </datalist>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="dailyWage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Wage (₹)*</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {documentSections.map((section, index) => (
                    <React.Fragment key={section.numberField}>
                      <Separator className="my-4" />
                      <CardTitle className="text-lg pt-2">{section.title}</CardTitle>
                      <FormField
                        control={form.control}
                        name={section.numberField}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{section.title} Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter document number" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {'expiryField' in section && (
                        <FormField
                          control={form.control}
                          name={section.expiryField}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{section.title} Expiry Date (Optional)</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                  >
                                    <span><CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </React.Fragment>
                ))}

              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting || isLoading ? (
                    <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving... </>
                  ) : (
                    <> <Save className="mr-2 h-4 w-4" /> Save Labourer </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}

function NewLabourRegisterPageWrapper() {
  return (
    <Suspense fallback={<NewLabourRegisterPageSkeleton />}>
      <NewLabourRegisterPageContent />
    </Suspense>
  );
}
export default NewLabourRegisterPageWrapper;
