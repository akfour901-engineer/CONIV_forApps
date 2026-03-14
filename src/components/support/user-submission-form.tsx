
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { USER_SUBMISSION_TYPE_OPTIONS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, UploadCloud } from 'lucide-react';

const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const submissionFormSchema = z.object({
  submissionType: z.enum(USER_SUBMISSION_TYPE_OPTIONS, { required_error: "Please select a request type." }),
  subject: z.string().min(5, "Subject must be at least 5 characters.").max(150),
  description: z.string().min(20, "Description must be at least 20 characters.").max(2000),
  attachmentUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Attachment is too large.").optional().nullable(),
});

type SubmissionFormValues = z.infer<typeof submissionFormSchema>;

export function UserSubmissionForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attachmentFileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const form = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionFormSchema),
    defaultValues: {
      submissionType: 'Query',
      subject: '',
      description: '',
      attachmentUrl: null,
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
            if (attachmentFileRef.current) attachmentFileRef.current.value = "";
            form.setValue("attachmentUrl", null);
            setSelectedFileName(null);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            form.setValue("attachmentUrl", reader.result as string);
            setSelectedFileName(file.name);
        };
        reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: SubmissionFormValues) => {
    if(!user) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/user-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit request.');
      }

      toast({
        title: "Request Submitted",
        description: "Thank you for your feedback! We will get back to you shortly.",
      });
      form.reset();
      setSelectedFileName(null);
      if(attachmentFileRef.current) attachmentFileRef.current.value = "";

    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="submissionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type of Request</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                <SelectContent>
                  {USER_SUBMISSION_TYPE_OPTIONS.map(type => (
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
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl><Input placeholder="e.g., Issue with invoice generation" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Please provide as much detail as possible..."
                  rows={6}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormItem>
            <FormLabel htmlFor="attachment">Attach File (Optional)</FormLabel>
            <div className="flex items-center space-x-2">
                <FormControl>
                    <Input id="attachment" type="file" ref={attachmentFileRef} onChange={handleFileChange} className="flex-1"/>
                </FormControl>
                 <Button type="button" variant="outline" onClick={() => attachmentFileRef.current?.click()} className="shrink-0"><UploadCloud className="mr-2 h-4 w-4" /> Choose File</Button>
            </div>
             {selectedFileName && <FormDescription>Selected: {selectedFileName}</FormDescription>}
             <FormMessage />
        </FormItem>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Submitting...</> : "Submit Request"}
        </Button>
      </form>
    </Form>
  );
}
