
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

export function LegalContentForm({ form }: { form: any }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" /> Legal Content
                </CardTitle>
                <CardDescription>
                    Manage the content for your Terms & Conditions and Privacy Policy pages. Use Markdown for formatting.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="termsAndConditionsContent"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Terms & Conditions</FormLabel>
                            <FormControl>
                                <Textarea rows={15} placeholder="Enter your Terms and Conditions content here..." {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="privacyPolicyContent"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Privacy Policy</FormLabel>
                            <FormControl>
                                <Textarea rows={15} placeholder="Enter your Privacy Policy content here..." {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    );
}
