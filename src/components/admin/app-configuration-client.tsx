
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { AppConfiguration } from '@/types/server-only';
import AdminAppConfigLoadingSkeleton from './loading';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import { AppConfigForm } from '@/components/admin/app-config-form';
import { Form } from '@/components/ui/form';
import { DEFAULT_COIN_PURCHASE_PACKAGES, DEFAULT_SIGNUP_RESOURCE_POINTS, DEFAULT_SYSTEM_EMAILS, DEFAULT_SOCIAL_LINKS, DEFAULT_TERMS_AND_CONDITIONS, DEFAULT_PRIVACY_POLICY, ACTION_COSTS_DISPLAY } from '@/lib/constants';
import { useRouter } from 'next/navigation';

const appConfigSchema = z.object({
  appName: z.string().min(1, "App Name is required."),
  defaultSignupResourcePoints: z.coerce.number().int().min(0),
  actionCosts: z.array(z.object({
    key: z.string(),
    label: z.string(),
    cost: z.coerce.number().min(0),
  })).optional(),
  coinPurchasePackages: z.array(z.object({
    id: z.string(),
    name: z.string().min(1),
    amount: z.coerce.number().min(1),
    points: z.coerce.number().int().min(1),
    description: z.string(),
  })).optional(),
  systemEmails: z.object({
    noReply: z.string().email(),
    support: z.string().email(),
    business: z.string().email(),
  }).optional(),
  razorpayKeyId: z.string().optional().nullable(),
  mobileAppUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  desktopAppUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  termsAndConditionsContent: z.string().optional(),
  privacyPolicyContent: z.string().optional(),
});

type AppConfigFormValues = z.infer<typeof appConfigSchema>;

function AppConfigurationClient() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  
  const form = useForm<AppConfigFormValues>({
    resolver: zodResolver(appConfigSchema),
    defaultValues: {
      appName: 'CONIV',
      defaultSignupResourcePoints: DEFAULT_SIGNUP_RESOURCE_POINTS,
      actionCosts: ACTION_COSTS_DISPLAY.map(item => ({...item, cost: 0})),
      coinPurchasePackages: DEFAULT_COIN_PURCHASE_PACKAGES,
      systemEmails: DEFAULT_SYSTEM_EMAILS,
      razorpayKeyId: "",
      mobileAppUrl: "",
      desktopAppUrl: "",
      termsAndConditionsContent: DEFAULT_TERMS_AND_CONDITIONS,
      privacyPolicyContent: DEFAULT_PRIVACY_POLICY,
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    
    if (user) {
      const fetchConfig = async () => {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/app-configuration', {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch configuration. Status: ${response.status}`);
          }
          const data: AppConfiguration = await response.json();
          form.reset({
              ...data,
              razorpayKeyId: data.razorpayKeyId || "",
              mobileAppUrl: data.mobileAppUrl || "",
              desktopAppUrl: data.desktopAppUrl || "",
              termsAndConditionsContent: data.termsAndConditionsContent || DEFAULT_TERMS_AND_CONDITIONS,
              privacyPolicyContent: data.privacyPolicyContent || DEFAULT_PRIVACY_POLICY,
          });
        } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };

      fetchConfig();
    }
  }, [user, isAdmin, authLoading, form, toast]);


  const onSubmit = async (values: AppConfigFormValues) => {
    if (!user || !isAdmin) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/app-configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to save configuration.');
      toast({ title: "Success", description: "Application configuration saved successfully." });
      router.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: `Could not save configuration: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return <AdminAppConfigLoadingSkeleton />;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You do not have administrative privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin: App Configuration</h1>
        <p className="text-muted-foreground">
          Manage global settings, costs, and content for the entire application.
        </p>
      </div>
       <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <AppConfigForm form={form} />
            <Card>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save All Changes</>}
                    </Button>
                </CardFooter>
            </Card>
        </form>
       </Form>
    </div>
  );
}

export default AppConfigurationClient;
