
'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, Document as AppDocument, DocumentType, TeamPermissions, AppConfiguration } from '@/types';
import { DOCUMENT_LINKING_COST, DOCUMENT_TYPES_OPTIONS } from '@/lib/constants';
import { PlusCircle, Save, Loader2, UploadCloud, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import NewDocumentPageSkeleton from '@/app/dashboard/documents/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { useLoading } from '@/contexts/loading-context';

const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

const documentFormSchema = z.object({
  documentName: z.string().min(1, "Document name is required.").max(255),
  documentType: z.string().refine(val => DOCUMENT_TYPES_OPTIONS.includes(val as DocumentType), { message: "Invalid document type." }),
  documentUrl: z.string().min(1, "A file must be uploaded.").max(MAX_FILE_SIZE_BYTES * 1.5, "Document URL/data too large. Max 3MB."), // Allow for base64 overhead
  workOrderIdForLinking: z.string().optional().nullable(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

export default function NewDocumentPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workOrderOptions, setWorkOrderOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const workOrderIdFromParamsRef = useRef<string | null>(null);

  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canManageDocuments = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDocuments || !!currentTeamMemberPermissions?.canCreateWorkOrders || !!currentTeamMemberPermissions?.canCreateEstimates;

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      documentName: "",
      documentType: "Other",
      documentUrl: "",
      workOrderIdForLinking: null,
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
          const woOpts = woData.map(data => ({
            value: data.id!,
            label: `${data.workOrderNumber} - ${data.scopeOfWork?.substring(0, 50) || 'Work Order'}...`,
          }));
          setWorkOrderOptions(woOpts);

          if (workOrderIdFromParamsRef.current && woOpts.some(opt => opt.value === workOrderIdFromParamsRef.current)) {
            form.setValue('workOrderIdForLinking', workOrderIdFromParamsRef.current, { shouldValidate: true });
          }
        } catch (error: any) {
          console.error("Error fetching work orders:", error);
          toast({ title: "Error", description: error.message || "Could not load work orders.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchWorkOrders();
    }
  }, [user, dataOwnerId, toast, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("documentUrl", "", { shouldValidate: true });
        setSelectedFileName(null);
        return;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({ title: "Invalid File Type", description: "Supported types: Images, PDF, Word, Excel, Text.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("documentUrl", "", { shouldValidate: true });
        setSelectedFileName(null);
        return;
      }
      if (!form.getValues("documentName")) {
        form.setValue("documentName", file.name.split('.').slice(0, -1).join('.') || file.name);
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          form.setValue("documentUrl", reader.result as string, { shouldValidate: true });
          setSelectedFileName(file.name);
          toast({ title: "File Selected", description: `${file.name} selected.` });
        }
      };
      reader.onerror = () => {
        toast({ title: "File Read Error", description: "Failed to read the file.", variant: "destructive" });
        setSelectedFileName(null);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFileName(null);
      form.setValue("documentUrl", "", { shouldValidate: true });
    }
  };

  const handleSubmit = async (values: DocumentFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canManageDocuments) {
      toast({ title: "Permission Denied", description: "You do not have permission to add documents.", variant: "destructive" });
      return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === "DOCUMENT_LINKING_COST")?.cost ?? DOCUMENT_LINKING_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;
    if (currentPoints < cost) {
      setPointsInfo({ required: cost, current: currentPoints });
      setIsPointsDialogOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, dataOwnerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
         if (errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }
        setIsSubmitting(false);
        return;
      }
      
      const createdDocumentResult: AppDocument & { newResourcePoints?: number; cost?: number } = await response.json();
      
      if (updateGlobalUserProfile && userProfile && createdDocumentResult.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: createdDocumentResult.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() } });
      }

      toast({ title: "Success", description: "Document saved successfully." });
      
      router.push('/dashboard/documents');
    } catch (error: any) {
      console.error("Error saving document:", error);
      toast({ title: "Error", description: error.message || "Failed to save document.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) return <NewDocumentPageSkeleton />;
  if (!user || !userProfile) { router.push('/auth/signin'); return <NewDocumentPageSkeleton />; }
  
  if (!canManageDocuments) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to add new documents.</p>
        <Button asChild className="mt-6"><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6 max-w-3xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New Document
            </h1>
            <p className="text-muted-foreground">Upload and classify a new document.</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/documents" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Documents
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <CardHeader>
                <CardTitle>Document Details</CardTitle>
                <CardDescription>Provide information about the document.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="documentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Site Plan Q1, Contract Agreement" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_TYPES_OPTIONS.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="workOrderIdForLinking"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Link to Work Order (Optional)</FormLabel>
                      <Combobox
                        options={workOrderOptions}
                        value={field.value || ""}
                        onChange={(val) => field.onChange(val === "" ? null : val)}
                        placeholder="Select Work Order..."
                        searchPlaceholder="Search Work Orders by WO#..."
                        disabled={isLoading || workOrderOptions.length === 0}
                        emptyResultText={isLoading ? "Loading..." : "No work orders found."}
                      />
                      {workOrderOptions.length === 0 && !isLoading && (
                        <FormDescription>
                          No Work Orders found. <Link href="/dashboard/work-orders/new" className="underline">Create a Work Order</Link> first.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel htmlFor="fileUpload">Upload File*</FormLabel>
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <span> {/* Span wrapper */}
                        <Input
                          id="fileUpload"
                          type="file"
                          accept={ALLOWED_FILE_TYPES.join(',')}
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="flex-grow"
                        />
                      </span>
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0"
                    >
                      <UploadCloud className="mr-2 h-4 w-4" /> Choose File
                    </Button>
                  </div>
                  <FormDescription>
                    Max {MAX_FILE_SIZE_MB}MB.
                    {selectedFileName && <span className="text-green-600 block mt-1">Selected: {selectedFileName}</span>}
                  </FormDescription>
                  <FormField control={form.control} name="documentUrl" render={() => <FormMessage />} />
                </FormItem>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Document
                    </>
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
