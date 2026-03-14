
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { UseFormReturn } from 'react-hook-form';
import { Trash2, PlusCircle, Coins, Settings, Mail, CreditCard, ExternalLink, LinkIcon, FileText } from "lucide-react";
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface AppConfigFormProps {
  form: UseFormReturn<any>;
}

export function AppConfigForm({ form }: AppConfigFormProps) {
  const { fields: actionCostFields, append: appendActionCost, remove: removeActionCost } = useFieldArray({ control: form.control, name: "actionCosts" });
  const { fields: coinPackageFields, append: appendCoinPackage, remove: removeCoinPackage } = useFieldArray({ control: form.control, name: "coinPurchasePackages" });
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center"><Settings className="mr-2"/> General Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField control={form.control} name="appName" render={({ field }) => (<FormItem><FormLabel>App Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)} />
          <FormField control={form.control} name="defaultSignupResourcePoints" render={({ field }) => (<FormItem><FormLabel>Default Signup Points</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center"><Coins className="mr-2"/>Action Costs</CardTitle><CardDescription>Set the resource point cost for various actions in the app.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {actionCostFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-center">
              <FormField control={form.control} name={`actionCosts.${index}.label`} render={({ field }) => (<FormItem><FormLabel className="text-xs font-normal">Action</FormLabel><FormControl><Input {...field} readOnly className="bg-secondary/50 text-xs h-9" /></FormControl><FormMessage/></FormItem>)} />
              <FormField control={form.control} name={`actionCosts.${index}.key`} render={({ field }) => (<FormItem><FormLabel className="text-xs font-normal">Key</FormLabel><FormControl><Input {...field} readOnly className="bg-secondary/50 text-xs h-9" /></FormControl><FormMessage/></FormItem>)} />
              <FormField control={form.control} name={`actionCosts.${index}.cost`} render={({ field }) => (<FormItem><FormLabel className="text-xs font-normal">Cost (Points)</FormLabel><FormControl><Input type="number" {...field} className="h-9" /></FormControl><FormMessage/></FormItem>)} />
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle className="flex items-center"><Mail className="mr-2"/> System Emails</CardTitle><CardDescription>Configure the `from` email addresses used for system notifications.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
            <FormField control={form.control} name="systemEmails.noReply" render={({ field }) => (<FormItem><FormLabel>No Reply Address</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Used for OTPs and automated system messages.</FormDescription><FormMessage/></FormItem>)} />
            <FormField control={form.control} name="systemEmails.support" render={({ field }) => (<FormItem><FormLabel>Support Address</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Used for support interactions and password resets.</FormDescription><FormMessage/></FormItem>)} />
            <FormField control={form.control} name="systemEmails.business" render={({ field }) => (<FormItem><FormLabel>Business Address</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Used for general business communication.</FormDescription><FormMessage/></FormItem>)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center"><CreditCard className="mr-2"/> Payment Gateway</CardTitle><CardDescription>Set your Razorpay API keys. These are stored securely on the server.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
            <FormField control={form.control} name="razorpayKeyId" render={({ field }) => (<FormItem><FormLabel>Razorpay Key ID</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="rzp_test_..." /></FormControl><FormMessage/></FormItem>)} />
            <p className="text-sm text-muted-foreground">The Razorpay Key Secret must be set as an environment variable (`RAZORPAY_KEY_SECRET`) on the server and cannot be configured here for security reasons.</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle className="flex items-center"><LinkIcon className="mr-2"/>App Links</CardTitle><CardDescription>Provide links to your mobile and desktop applications.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
            <FormField control={form.control} name="mobileAppUrl" render={({ field }) => (<FormItem><FormLabel>Mobile App URL (.apk)</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="https://example.com/app.apk" /></FormControl><FormMessage/></FormItem>)} />
            <FormField control={form.control} name="desktopAppUrl" render={({ field }) => (<FormItem><FormLabel>Desktop App URL (.exe)</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="https://example.com/app.exe" /></FormControl><FormMessage/></FormItem>)} />
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader><CardTitle className="flex items-center"><FileText className="mr-2"/>Legal Content</CardTitle><CardDescription>Edit the content for your Terms & Conditions and Privacy Policy pages. Supports Markdown.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
            <FormField control={form.control} name="termsAndConditionsContent" render={({ field }) => (<FormItem><FormLabel>Terms and Conditions</FormLabel><FormControl><Textarea {...field} rows={10} /></FormControl><FormMessage/></FormItem>)} />
             <Separator />
            <FormField control={form.control} name="privacyPolicyContent" render={({ field }) => (<FormItem><FormLabel>Privacy Policy</FormLabel><FormControl><Textarea {...field} rows={10} /></FormControl><FormMessage/></FormItem>)} />
        </CardContent>
      </Card>

    </div>
  );
}
