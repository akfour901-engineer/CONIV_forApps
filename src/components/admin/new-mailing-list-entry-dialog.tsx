
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Textarea } from '../ui/textarea';

const entryFormSchema = z.object({
  email: z.string().email("Invalid email format."),
  name: z.string().max(100).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

type EntryFormValues = z.infer<typeof entryFormSchema>;

interface NewMailingListEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEntryAdded: () => void;
}

export function NewMailingListEntryDialog({ isOpen, onOpenChange, onEntryAdded }: NewMailingListEntryDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: { email: "", name: "", company: "", phone: "", notes: "" },
  });

  const onSubmit = async (values: EntryFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/mailing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to add entry.');
      }

      toast({ title: "Success", description: "New entry added to the mail database." });
      form.reset();
      onEntryAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error Adding Entry", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Mail Entry</DialogTitle>
          <DialogDescription>
            Manually add a new contact to your mail database.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} id="new-entry-form" className="space-y-4 py-2">
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email*</FormLabel><FormControl><Input placeholder="contractor@email.com" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="company" render={({ field }) => ( <FormItem><FormLabel>Company</FormLabel><FormControl><Input placeholder="Acme Construction" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" placeholder="+91..." {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="e.g., Met at expo, interested in invoicing." {...field} value={field.value ?? ""} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="new-entry-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Adding...</> : <><Save className="mr-2 h-4 w-4"/>Add Entry</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
