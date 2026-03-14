
'use client';

import { useState } from 'react';
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

const listFormSchema = z.object({
  name: z.string().min(2, "List name is required.").max(100),
  description: z.string().max(200).optional().nullable(),
});

type ListFormValues = z.infer<typeof listFormSchema>;

interface NewMailingListDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onListAdded: () => void;
}

export function NewMailingListDialog({ isOpen, onOpenChange, onListAdded }: NewMailingListDialogProps) {
  const { user, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ListFormValues>({
    resolver: zodResolver(listFormSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (values: ListFormValues) => {
    if (!user || !dataOwnerId) return;

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/marketing/mailing-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, userId: dataOwnerId }),
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to create list.');
      }

      toast({ title: "Success", description: "New mailing list created." });
      onListAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Mailing List</DialogTitle>
          <DialogDescription>
            Organize your contacts into targeted groups.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} id="new-list-form" className="space-y-4 py-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>List Name*</FormLabel>
                <FormControl><Input placeholder="e.g., Past Clients, New Leads" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="A brief description of this list..." {...field} value={field.value ?? ""} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="new-list-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating...</> : <><Save className="mr-2 h-4 w-4"/>Create List</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
