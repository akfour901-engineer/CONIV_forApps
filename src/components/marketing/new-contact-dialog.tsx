'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { Organization, Subcontractor, AppConfiguration, MailingList, MailingListEntry } from '@/types/server-only';
import { MAILING_LIST_ADDITION_COST } from '@/lib/constants';
import { InsufficientPointsDialog } from '../dashboard/insufficient-points-dialog';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';

const contactFormSchema = z.object({
  email: z.string().email("Invalid email format."),
  name: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  organizationId: z.string().optional().nullable(),
  subcontractorId: z.string().optional().nullable(),
  mailingListIds: z.array(z.string()).optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface NewContactDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded: () => void;
  onContactUpdated: () => void;
  mailingLists: MailingList[];
  organizations: Organization[];
  subcontractors: Subcontractor[];
  editingContact?: MailingListEntry | null;
}

export function NewContactDialog({ 
    isOpen, 
    onOpenChange, 
    onContactAdded, 
    onContactUpdated,
    mailingLists,
    organizations,
    subcontractors,
    editingContact
}: NewContactDialogProps) {
  const { user, dataOwnerId, userProfile, appConfig, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const isEditing = !!editingContact;

  const organizationOptions = useMemo(() => organizations.map(o => ({ value: o.id!, label: o.name })), [organizations]);
  const subcontractorOptions = useMemo(() => subcontractors.map(s => ({ value: s.id!, label: s.name })), [subcontractors]);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: '', name: '', phone: '', notes: '', organizationId: null, subcontractorId: null, mailingListIds: [],
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        form.reset({
            email: editingContact.email,
            name: editingContact.name,
            phone: editingContact.phone,
            notes: editingContact.notes,
            organizationId: editingContact.organizationId,
            subcontractorId: editingContact.subcontractorId,
            mailingListIds: editingContact.mailingListIds || [],
        });
      } else {
        form.reset({
            email: '', name: '', phone: '', notes: '', organizationId: null, subcontractorId: null, mailingListIds: [],
        });
      }
    }
  }, [isOpen, editingContact, isEditing, form]);

  const onSubmit = async (values: ContactFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) return;

    if (!isEditing) {
        const cost = appConfig?.actionCosts?.find(c => c.key === 'MAILING_LIST_ADDITION_COST')?.cost ?? MAILING_LIST_ADDITION_COST;
        const currentPoints = userProfile.resourcePoints ?? 0;
        if (currentPoints < cost) {
          setPointsInfo({ required: cost, current: currentPoints });
          setIsPointsDialogOpen(true);
          return;
        }
    }

    setIsSubmitting(true);
    const url = isEditing ? `/api/marketing/mailing-list-entries/${editingContact.id}` : '/api/marketing/mailing-list-entries';
    const method = isEditing ? 'PUT' : 'POST';
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, dataOwnerId }),
      });

      const result = await response.json();
      if (!response.ok) {
        if(response.status === 409) {
            toast({ title: "Contact Exists", description: result.error, variant: "destructive" });
        } else {
            throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'add'} contact.`);
        }
      } else {
        toast({ title: "Success", description: `Contact ${isEditing ? 'updated' : 'added'} successfully.` });
        if (isEditing) {
            onContactUpdated();
        } else {
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
               updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }});
            }
            onContactAdded();
        }
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const mailingListOptions = useMemo(() => mailingLists.map(list => ({
      id: list.id!,
      label: list.name,
  })), [mailingLists]);

  return (
    <>
    <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>{isEditing ? "Edit Contact" : "Add New Contact"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Modify the details of this contact." : "Enter details for a new contact in your mailing list."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="contact-form" className="space-y-4 py-2">
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email*</FormLabel><FormControl><Input placeholder="contact@example.com" {...field} readOnly={isEditing} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" placeholder="+91..." {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem>)}/>
              </div>
              <FormField control={form.control} name="organizationId" render={({ field }) => (
                  <FormItem><FormLabel>Link to Organization (Optional)</FormLabel>
                  <Combobox options={organizationOptions} value={field.value || ""} onChange={field.onChange} placeholder="Select Organization..." searchPlaceholder="Search..." />
                  <FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="subcontractorId" render={({ field }) => (
                  <FormItem><FormLabel>Link to Subcontractor (Optional)</FormLabel>
                  <Combobox options={subcontractorOptions} value={field.value || ""} onChange={field.onChange} placeholder="Select Subcontractor..." searchPlaceholder="Search..." />
                  <FormMessage /></FormItem>
              )}/>
              <FormField
                control={form.control}
                name="mailingListIds"
                render={() => (
                  <FormItem>
                    <div className="mb-2">
                      <FormLabel>Assign to Lists</FormLabel>
                    </div>
                     <ScrollArea className="h-32 w-full rounded-md border p-4">
                      {mailingListOptions.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="mailingListIds"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={item.id}
                                className="flex flex-row items-start space-x-3 space-y-0 mb-2"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), item.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== item.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm">
                                  {item.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="e.g., Met at trade show." {...field} value={field.value ?? ""} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
            </form>
          </Form>
        </div>
        <DialogFooter className="p-6 pt-4 border-t shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="contact-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving...</> : <><Save className="mr-2 h-4 w-4"/>{isEditing ? 'Save Changes' : 'Add Contact'}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}