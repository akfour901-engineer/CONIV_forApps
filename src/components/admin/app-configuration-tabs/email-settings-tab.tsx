
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { UseFormReturn } from 'react-hook-form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { EMAIL_TEMPLATE_METADATA } from '@/lib/constants';
import type { EmailTemplates } from '@/types/server-only';

interface EmailSettingsTabProps {
  form: UseFormReturn<any>;
}

export function EmailSettingsTab({ form }: EmailSettingsTabProps) {
    const templateKeys = Object.keys(EMAIL_TEMPLATE_METADATA) as (keyof EmailTemplates)[];
    return (
        <Card>
        <CardHeader>
            <CardTitle>Email Settings</CardTitle>
            <CardDescription>
                Configure system email addresses and customize email templates. Use placeholders like {"{{USER_NAME}}"} or {"{{OTP}}"} where applicable.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <h3 className="text-lg font-medium">System Email Addresses</h3>
            <div className="grid md:grid-cols-3 gap-4">
                 <FormField
                    control={form.control}
                    name="systemEmails.noReply"
                    render={({ field }) => (
                        <FormItem><FormLabel>No-Reply Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="systemEmails.support"
                    render={({ field }) => (
                        <FormItem><FormLabel>Support Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="systemEmails.business"
                    render={({ field }) => (
                        <FormItem><FormLabel>Business Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                    />
            </div>
            <h3 className="text-lg font-medium pt-4">Email Templates</h3>
            <Accordion type="single" collapsible className="w-full">
                {templateKeys.map(key => (
                    <AccordionItem value={key} key={key}>
                        <AccordionTrigger>{EMAIL_TEMPLATE_METADATA[key].title}</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                             <p className="text-xs text-muted-foreground">{EMAIL_TEMPLATE_METADATA[key].description}</p>
                             <FormField
                                control={form.control}
                                name={`emailTemplates.${key}.subject`}
                                render={({ field }) => (
                                    <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}
                                />
                             <FormField
                                control={form.control}
                                name={`emailTemplates.${key}.body`}
                                render={({ field }) => (
                                    <FormItem><FormLabel>Body (HTML)</FormLabel><FormControl><Textarea {...field} rows={8} /></FormControl><FormMessage /></FormItem>
                                )}
                                />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </CardContent>
        </Card>
    );
}
