'use client';

import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { EMAIL_TEMPLATE_METADATA } from '@/lib/constants';

type AppConfigFormValues = any; // Simplified for this component

interface AppConfigFormProps {
  form: UseFormReturn<AppConfigFormValues>;
}

export function AppConfigForm({ form }: AppConfigFormProps) {
    const { fields: costFields } = useFieldArray({ control: form.control, name: "actionCosts" });
    const { fields: packageFields, append: appendPackage, remove: removePackage } = useFieldArray({ control: form.control, name: "coinPurchasePackages" });
    const { fields: emailTemplateFields } = useFieldArray({ control: form.control, name: "emailTemplates" });


  return (
    <div className="space-y-6">
        <Card>
            <CardHeader><CardTitle>General Settings</CardTitle><CardDescription>Basic application and integration settings.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <FormField control={form.control} name="appName" render={({ field }) => (<FormItem><FormLabel>App Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="defaultSignupResourcePoints" render={({ field }) => (<FormItem><FormLabel>Default Signup Points</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>The number of resource points a new user gets upon signing up.</FormDescription><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="razorpayKeyId" render={({ field }) => (<FormItem><FormLabel>Razorpay Key ID</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="razorpayKeySecret" render={({ field }) => (<FormItem><FormLabel>Razorpay Key Secret</FormLabel><FormControl><Input type="password" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="mobileAppUrl" render={({ field }) => (<FormItem><FormLabel>Android App URL (.apk)</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="desktopAppUrl" render={({ field }) => (<FormItem><FormLabel>Windows App URL (.exe)</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                
                <h4 className="font-medium">Social Media Links</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="socialLinks.youtube" render={({ field }) => (<FormItem><FormLabel>YouTube</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="socialLinks.linkedin" render={({ field }) => (<FormItem><FormLabel>LinkedIn</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="socialLinks.instagram" render={({ field }) => (<FormItem><FormLabel>Instagram</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="socialLinks.facebook" render={({ field }) => (<FormItem><FormLabel>Facebook</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="socialLinks.twitter" render={({ field }) => (<FormItem><FormLabel>X (Twitter)</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </CardContent>
        </Card>

      <Card>
        <CardHeader><CardTitle>Action Costs</CardTitle><CardDescription>Set the resource point cost for various actions within the app. Set to 0 for free.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Action</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
            <TableBody>
              {costFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell><FormLabel>{form.getValues(`actionCosts.${index}.label`)}</FormLabel></TableCell>
                  <TableCell className="text-right">
                    <FormField control={form.control} name={`actionCosts.${index}.cost`} render={({ field }) => (
                      <FormItem><FormControl><Input type="number" className="w-24 text-right" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Coin Purchase Packages</CardTitle><CardDescription>Configure the packages users can purchase.</CardDescription></CardHeader>
        <CardContent>
          {packageFields.map((field, index) => (
            <div key={field.id} className="p-4 border rounded-md mb-4 space-y-2 relative">
                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => removePackage(index)}><Trash2 className="h-4 w-4" /></Button>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name={`coinPurchasePackages.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Package Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`coinPurchasePackages.${index}.id`} render={({ field }) => (<FormItem><FormLabel>Package ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`coinPurchasePackages.${index}.amount`} render={({ field }) => (<FormItem><FormLabel>Amount (INR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`coinPurchasePackages.${index}.points`} render={({ field }) => (<FormItem><FormLabel>Points Awarded</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <FormField control={form.control} name={`coinPurchasePackages.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          ))}
          <Button type="button" onClick={() => appendPackage({ id: `pack_${Date.now()}`, name: "", amount: 0, points: 0, description: "" })} className="mt-2">Add Package</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>System Emails</CardTitle><CardDescription>Configure sender email addresses.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
            <FormField control={form.control} name="systemEmails.noReply" render={({ field }) => (<FormItem><FormLabel>No-Reply Address</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="systemEmails.support" render={({ field }) => (<FormItem><FormLabel>Support Address</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="systemEmails.business" render={({ field }) => (<FormItem><FormLabel>Business Address</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Legal Content</CardTitle><CardDescription>Manage Terms & Conditions and Privacy Policy content.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
            <FormField control={form.control} name="termsAndConditionsContent" render={({ field }) => (<FormItem><FormLabel>Terms & Conditions (Markdown)</FormLabel><FormControl><Textarea rows={10} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="privacyPolicyContent" render={({ field }) => (<FormItem><FormLabel>Privacy Policy (Markdown)</FormLabel><FormControl><Textarea rows={10} {...field} /></FormControl><FormMessage /></FormItem>)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Email Templates</CardTitle><CardDescription>Edit the subject and body for system-sent emails. Use placeholders like {"{USER_NAME}"} or {"{OTP}"}.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            {Object.entries(EMAIL_TEMPLATE_METADATA).map(([key, metadata]) => (
                <div key={key} className="p-4 border rounded-lg">
                    <h4 className="font-semibold">{metadata.title}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{metadata.description}</p>
                    <div className="space-y-2">
                        <FormField control={form.control} name={`emailTemplates.${key}.subject`} render={({ field }) => (<FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name={`emailTemplates.${key}.body`} render={({ field }) => (<FormItem><FormLabel>Body (HTML)</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl></FormItem>)} />
                    </div>
                </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
