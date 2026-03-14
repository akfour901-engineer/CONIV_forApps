'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { AppConfiguration, AppConfigActionCost } from '@/types';
import AdminAppConfigLoadingSkeleton from './loading';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import { AppConfigForm } from '@/components/admin/app-config-form';
import { Form } from '@/components/ui/form';
import {
  DEFAULT_COIN_PURCHASE_PACKAGES,
  DEFAULT_SIGNUP_RESOURCE_POINTS,
  DEFAULT_SYSTEM_EMAILS,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_TERMS_AND_CONDITIONS,
  DEFAULT_PRIVACY_POLICY
} from '@/types';
import {
  
  ACTION_COSTS_DISPLAY
} from '@/types/server-only';
import { useRouter } from 'next/navigation';

const appConfigSchema = z.object({
  appName: z.string().min(1, "App Name is required."),
  defaultSignupResourcePoints: z.coerce.number().int().min(0),
  razorpayKeyId: z.string().optional().nullable(),
  razorpayKeySecret: z.string().optional().nullable(),
  socialLinks: z.object({
    youtube: z.string().url().optional().or(z.literal('')),
    linkedin: z.string().url().optional().or(z.literal('')),
    instagram: z.string().url().optional().or(z.literal('')),
    facebook: z.string().url().optional().or(z.literal('')),
    twitter: z.string().url().optional().or(z.literal('')),
  }).optional(),
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
  mobileAppUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  desktopAppUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  termsAndConditionsContent: z.string().optional(),
  privacyPolicyContent: z.string().optional(),
});

type AppConfigFormValues = z.infer<typeof appConfigSchema>;

function AppConfigurationClientPage() {
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
      razorpayKeyId: "",
      razorpayKeySecret: "",
      socialLinks: DEFAULT_SOCIAL_LINKS,
      actionCosts: Object.entries(ACTION_COSTS_DISPLAY).map(([key, value]) => ({
        key,
        cost: Number(value), // ensure cost is number
        label: key, // fallback — replace with real labels if available
      })),
      coinPurchasePackages: DEFAULT_COIN_PURCHASE_PACKAGES.map(pkg => ({ ...pkg })),
      systemEmails: DEFAULT_SYSTEM_EMAILS,
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

          // Map actionCosts safely (cost is number)
          const mappedActionCosts = data.actionCosts?.map((item: AppConfigActionCost) => ({
            key: item.key,
            label: item.label || item.key,
            cost: item.cost,
          })) || Object.entries(ACTION_COSTS_DISPLAY).map(([key, value]) => ({
            key,
            cost: Number(value), // explicit number conversion
            label: key,
          }));

          form.reset({
            ...data,
            razorpayKeyId: data.razorpayKeyId || "",
            razorpayKeySecret: data.razorpayKeySecret || "",
            socialLinks: data.socialLinks || DEFAULT_SOCIAL_LINKS,
            mobileAppUrl: data.mobileAppUrl || "",
            desktopAppUrl: data.desktopAppUrl || "",
            termsAndConditionsContent: data.termsAndConditionsContent || DEFAULT_TERMS_AND_CONDITIONS,
            privacyPolicyContent: data.privacyPolicyContent || DEFAULT_PRIVACY_POLICY,
            actionCosts: mappedActionCosts,
            coinPurchasePackages: data.coinPurchasePackages?.map(pkg => ({ ...pkg })) ||
              DEFAULT_COIN_PURCHASE_PACKAGES.map(pkg => ({ ...pkg })),
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
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save All Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}

export default function AppConfigurationPage() {
  return (
    <Suspense fallback={<AdminAppConfigLoadingSkeleton />}>
      <AppConfigurationClientPage />
    </Suspense>
  );
}