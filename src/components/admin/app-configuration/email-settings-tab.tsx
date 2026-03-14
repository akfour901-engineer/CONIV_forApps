
'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EMAIL_TEMPLATE_METADATA } from "@/lib/constants"
import type { EmailTemplates } from "@/types/server-only"

interface EmailSettingsTabContentProps {
    form: any; // react-hook-form form instance
}

export function EmailSettingsTabContent({ form }: EmailSettingsTabContentProps) {
    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle>System & Email Configuration</CardTitle>
                <CardDescription>
                    Configure system-wide email addresses and automated email templates.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="systemEmails.noReply" render={({ field }) => (<FormItem><FormLabel>No-Reply Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="systemEmails.support" render={({ field }) => (<FormItem><FormLabel>Support Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="systemEmails.business" render={({ field }) => (<FormItem><FormLabel>Business Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </div>
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="email-templates">
                        <AccordionTrigger className="text-lg font-medium">Email Templates</AccordionTrigger>
                        <AccordionContent>
                             <CardDescription className="mb-4">
                                Customize the content for automated emails sent by the system. Use placeholders like {"{{OTP}}"} or {"{{USER_NAME}}"} where applicable.
                            </CardDescription>
                            <div className="space-y-6">
                            {(Object.keys(EMAIL_TEMPLATE_METADATA) as Array<keyof EmailTemplates>).map(key => (
                                <div key={key} className="p-4 border rounded-md">
                                    <h4 className="font-semibold text-primary">{EMAIL_TEMPLATE_METADATA[key].title}</h4>
                                    <p className="text-xs text-muted-foreground mb-2">{EMAIL_TEMPLATE_METADATA[key].description}</p>
                                    <FormField
                                        control={form.control}
                                        name={`emailTemplates.${key}.subject`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Subject</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`emailTemplates.${key}.body`}
                                        render={({ field }) => (
                                            <FormItem className="mt-2">
                                                <FormLabel>Body (HTML)</FormLabel>
                                                <FormControl><Textarea {...field} rows={8} className="font-mono text-xs"/></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                 </Accordion>
            </CardContent>
        </Card>
    )
}
