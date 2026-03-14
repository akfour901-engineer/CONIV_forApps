'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';

const contactFormSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().optional(),
  message: z.string().min(10, "Message should be at least 10 characters.").max(1000),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface PublicContactFormProps {
  portfolioId: string;
  portfolioOwnerId: string;
  portfolioName: string;
}

export default function PublicContactForm({ portfolioId, portfolioOwnerId, portfolioName }: PublicContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

  useEffect(() => {
    // This effect runs on the client after the initial render and dangerouslySetInnerHTML.
    // It finds the placeholder div and sets it as the portal container.
    const placeholder = document.getElementById('contact-form-placeholder');
    if (placeholder) {
      setContainer(placeholder);
    }
  }, [portfolioId]); // Re-run if portfolio changes to find the new placeholder

  const onSubmit = async (values: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/portfolio-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, portfolioId, portfolioOwnerId, portfolioName }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message.');
      }
      setIsSubmitted(true);
      toast({ title: "Message Sent!", description: "Your message has been delivered." });
      form.reset();
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = isSubmitted ? (
      <div className="text-center p-8 bg-green-50 rounded-lg">
        <h3 className="text-xl font-semibold text-green-800">Thank You!</h3>
        <p className="text-green-700 mt-2">Your message has been sent successfully.</p>
      </div>
  ) : (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
         <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel data-editable="true" className="text-gray-700">Your Name</FormLabel><FormControl><Input placeholder="Your name" {...field} className="bg-white" /></FormControl><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel data-editable="true" className="text-gray-700">Your Email</FormLabel><FormControl><Input type="email" placeholder="you@example.com" {...field} className="bg-white" /></FormControl><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel data-editable="true" className="text-gray-700">Your Phone (Optional)</FormLabel><FormControl><Input type="tel" placeholder="+91 98765 43210" {...field} className="bg-white" /></FormControl><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel data-editable="true" className="text-gray-700">Message</FormLabel><FormControl><Textarea placeholder="Tell us about your project..." {...field} rows={4} className="bg-white" /></FormControl><FormMessage /></FormItem> )} />
         <Button type="submit" className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-primary/90" disabled={isSubmitting}>
           {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Sending...</> : 'Send Message'}
         </Button>
      </form>
    </Form>
  );

  // If the container div isn't in the DOM yet, don't render anything.
  // Once it's found by the useEffect, this will re-render and the portal will be created.
  if (!container) return null;

  return createPortal(formContent, container);
}
