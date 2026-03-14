'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Save } from 'lucide-react';
import type { AppConfiguration, AppConfigActionCost, AppConfigCoinPurchasePackage, SystemEmails, EmailTemplates, SocialLinks } from '@/types';
import { ACTION_COSTS_DISPLAY, DEFAULT_COIN_PURCHASE_PACKAGES, DEFAULT_SYSTEM_EMAILS, DEFAULT_EMAIL_TEMPLATES, DEFAULT_SOCIAL_LINKS } from '@/lib/constants';

const actionCostSchema = z.object({
  key: z.string(),
  label: z.string(),
  cost: z.coerce.number().min(0, "Cost must be non-negative."),
});

const coinPackageSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.coerce.number().min(0),
  points: z.coerce.number().min(0),
  description: z.string(),
});

const appConfigFormSchema = z.object({
  appName: z.string().min(1, "App Name is required."),
  defaultSignupResourcePoints: z.coerce.number().min(0),
  razorpayKeyId: z.string().optional().nullable(),
  actionCosts: z.array(actionCostSchema),
  coinPurchasePackages: z.array(coinPackageSchema),
  // Add other fields as needed
});

type AppConfigFormValues = z.infer<typeof appConfigFormSchema>;

export default function AppConfigClientPage() {
  const { appConfig, user, refreshContext } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AppConfigFormValues>({
    resolver: zodResolver(appConfigFormSchema),
    defaultValues: {
      appName: appConfig?.appName || '',
      defaultSignupResourcePoints: appConfig?.defaultSignupResourcePoints || 0,
      razorpayKeyId: appConfig?.razorpayKeyId || '',
      actionCosts: appConfig?.actionCosts || [],
      coinPurchasePackages: appConfig?.coinPurchasePackages || [],
    },
  });

  const onSubmit = async (values: AppConfigFormValues) => {
    setIsSaving(true);
    try {
      if (!user) throw new Error("Authentication required.");
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/app-configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save configuration.");
      }
      
      await refreshContext(); // Refresh the auth context to get new appConfig
      toast({ title: "Success", description: "Application configuration has been updated." });

    } catch (error: any) {
      toast({ title: "Error Saving", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Application Configuration</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <FormField control={form.control} name="appName" render={({ field }) => (<FormItem><FormLabel>App Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="defaultSignupResourcePoints" render={({ field }) => (<FormItem><FormLabel>Default Signup Points</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="razorpayKeyId" render={({ field }) => (<FormItem><FormLabel>Razorpay Key ID</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormDescription>This is the public key for Razorpay integration.</FormDescription><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Action Costs</CardTitle><CardDescription>Set the resource point cost for various actions in the app.</CardDescription></CardHeader>
            <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
              {form.getValues('actionCosts').map((cost, index) => (
                <FormField
                  key={cost.key}
                  control={form.control}
                  name={`actionCosts.${index}.cost`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{cost.label}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Coin Purchase Packages</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {form.getValues('coinPurchasePackages').map((pkg, index) => (
                <div key={pkg.id} className="p-4 border rounded-md grid grid-cols-1 md:grid-cols-3 gap-4">
                   <FormField control={form.control} name={`coinPurchasePackages.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Package Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                   <FormField control={form.control} name={`coinPurchasePackages.${index}.amount`} render={({ field }) => (<FormItem><FormLabel>Amount (INR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                   <FormField control={form.control} name={`coinPurchasePackages.${index}.points`} render={({ field }) => (<FormItem><FormLabel>Points Awarded</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                </div>
              ))}
            </CardContent>
          </Card>
          
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" />Save All Changes</>}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </div>
  );
}
