
'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
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
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, Document as AppDocument, DocumentType } from '@/types';
import { DOCUMENT_TYPES_OPTIONS } from '@/lib/constants';
import { Edit, Save, Loader2, UploadCloud, ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import EditDocumentLoadingSkeleton from './loading';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];


const documentFormSchema = z.object({
  documentName: z.string().min(1, "Document name is required.").max(255),
  documentType: z.string().refine(val => DOCUMENT_TYPES_OPTIONS.includes(val as DocumentType), { message: "Invalid document type." }),
  documentUrl: z.string().optional().nullable(),
  workOrderIdForLinking: z.string().optional().nullable(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

export default function EditDocumentPageContent({ documentId }: { documentId: string }) {
  const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [document, setDocument] = useState<AppDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workOrderOptions, setWorkOrderOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const canManageDocuments = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDocuments;

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
    if (!authLoading && user && dataOwnerId) {
      setIsLoadingWorkOrders(true);
      const fetchWorkOrders = async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error('Failed to fetch work orders');
          const woData: WorkOrder[] = await response.json();
          setWorkOrderOptions(woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));
        } catch (error) {
          toast({ title: "Error", description: "Could not load work orders.", variant: "destructive" });
        } finally {
          setIsLoadingWorkOrders(false);
        }
      };
      fetchWorkOrders();
    }
  }, [user, dataOwnerId, authLoading, toast]);


  useEffect(() => {
    if (authLoading || !user || !dataOwnerId) return;

    if (!canManageDocuments) {
        toast({ title: "Permission Denied", description: "You do not have permission to view or edit documents.", variant: "destructive" });
        router.push('/dashboard/documents');
        return;
    }

    const fetchDocument = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/documents/${documentId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch document.');
        }
        const data: AppDocument = await response.json();
        setDocument(data);
        form.reset({
          documentName: data.documentName,
          documentType: data.documentType,
          documentUrl: data.documentUrl,
          workOrderIdForLinking: data.workOrderId,
        });
        if(data.documentUrl) setSelectedFileName("Existing Document Attached");
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        router.push('/dashboard/documents');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocument();
  }, [documentId, user, dataOwnerId, authLoading, router, toast, form, canManageDocuments]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("documentUrl", document?.documentUrl || "");
        setSelectedFileName(null);
        return;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({ title: "Invalid File Type", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          form.setValue("documentUrl", reader.result as string, { shouldValidate: true });
          setSelectedFileName(file.name);
          toast({ title: "File Selected", description: `${file.name} selected. Save to confirm change.` });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: DocumentFormValues) => {
    if (!user || !documentId || !canManageDocuments) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update document.');
      }
      toast({ title: "Success", description: "Document updated successfully." });
      router.push('/dashboard/documents');
    } catch (error: any) {
      console.error("Error updating document:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <EditDocumentLoadingSkeleton />;
  
  if (!canManageDocuments) {
     return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"> <AlertTriangle className="w-16 h-16 text-destructive mb-4" /> <h2 className="text-xl font-semibold">Permission Denied</h2> <p className="text-muted-foreground">You do not have permission to edit documents.</p> <Button asChild className="mt-6"> <Link href="/dashboard/documents">Back to Documents</Link> </Button> </div> );
  }

  if (!document) return <p className="text-center">Document not found.</p>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Edit className="mr-3 h-7 w-7 text-primary" /> Edit Document
          </h1>
          <p className="text-muted-foreground">Modifying: {document.documentName}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/documents">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Documents
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="documentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Name*</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      disabled={isLoadingWorkOrders || workOrderOptions.length === 0}
                      emptyResultText={isLoadingWorkOrders ? "Loading..." : "No work orders found."}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormItem>
                  <FormLabel htmlFor="fileUpload">Upload/Replace File*</FormLabel>
                   {(form.watch('documentUrl') || document.documentUrl) && (
                    <div className="mb-1">
                      <a href={form.getValues('documentUrl')! || document.documentUrl!} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center">
                        <ExternalLink className="mr-1 h-4 w-4" /> View Current Document
                      </a>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <span>
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
                    {selectedFileName && selectedFileName !== "Existing Document Attached" && <span className="text-green-600 block mt-1">Selected: {selectedFileName}</span>}
                  </FormDescription>
                  <FormField control={form.control} name="documentUrl" render={() => <FormMessage />} />
                </FormItem>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Update Document
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
