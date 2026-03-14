
'use client';

import React, { useState, useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { User } from 'firebase/auth';
import type { UserProfile, AppConfiguration, UserNotificationPreferences } from '@/types/server-only';
import { Save, Loader2, Shield, Bell, Palette, Lock, KeyRound, Download, Trash2, AlertTriangle, Sun, Moon, Laptop, Settings as SettingsIcon } from 'lucide-react';
import { SetupPinDialog } from '@/components/settings/pin-input-dialog';
import { ChangePinDialog } from '@/components/settings/change-pin-dialog';
import { useTheme } from 'next-themes';
import type { ExportDataOutput } from '@/ai/flows/export-user-data-flow';
import Link from 'next/link';
import { SecuritySettingsTabContent } from '@/components/settings/security-settings-tab';
import { NotificationSettingsTabContent } from '@/components/settings/notification-settings-tab';
import { AppearanceSettingsTabContent } from '@/components/settings/appearance-settings-tab';
import { DataPrivacyTabContent } from '@/components/settings/data-privacy-tab';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from "@/components/ui/card";
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';

interface SettingsClientPageProps {
    user: User;
    userProfile: UserProfile;
    appConfig: AppConfiguration | null;
    refreshContext: () => Promise<void>;
}

const preferencesSchema = z.object({
  notifications: z.object({
    workOrderStatusAlerts: z.boolean().default(true),
    weeklyInvoiceFollowups: z.boolean().default(false),
    weeklySecurityDepositFollowups: z.boolean().default(false),
    weeklyFinancialSummary: z.boolean().default(false),
    weeklyLicensesDue: z.boolean().default(true),
    weeklyTopAlerts: z.boolean().default(true),
    marketplaceUpdates: z.boolean().default(true),
    newLoginAlerts: z.boolean().default(true),
    largeExpenseAlerts: z.boolean().default(true), 
    projectBudgetWatch: z.boolean().default(true), 
    profitabilityDipAlerts: z.boolean().default(true), 
    importantUpdates: z.boolean().default(true),
    newMessages: z.boolean().default(true),
    invoicePaid: z.boolean().default(true),
    preferredDigestDay: z.string().optional().default('Monday'),
  }),
  logActiveTime: z.boolean().default(false),
  passwordChangeDays: z.number().int().min(30).optional().nullable(),
  pinChangeDays: z.number().int().min(30).optional().nullable(),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function SettingsClientPage({ user, userProfile, appConfig, refreshContext }: SettingsClientPageProps) {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isRequestingExport, setIsRequestingExport] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSecurityActionLoading, setIsSecurityActionLoading] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  
  const preferencesForm = useForm<PreferencesFormValues>({
      resolver: zodResolver(preferencesSchema),
      defaultValues: {
          notifications: userProfile.notificationPreferences || {
              workOrderStatusAlerts: true, weeklyInvoiceFollowups: false, weeklySecurityDepositFollowups: false,
              weeklyFinancialSummary: false, weeklyLicensesDue: true, weeklyTopAlerts: true,
              marketplaceUpdates: true, newLoginAlerts: true, largeExpenseAlerts: true,
              projectBudgetWatch: true, profitabilityDipAlerts: true, importantUpdates: true, newMessages: true, invoicePaid: true,
              preferredDigestDay: 'Monday',
          },
          logActiveTime: userProfile.logActiveTime || false,
          passwordChangeDays: userProfile.passwordChangeDays ?? null,
          pinChangeDays: userProfile.pinChangeDays ?? null,
      }
  });

  useEffect(() => {
    if (userProfile) {
        preferencesForm.reset({
             notifications: userProfile.notificationPreferences || {
              workOrderStatusAlerts: true, weeklyInvoiceFollowups: false, weeklySecurityDepositFollowups: false,
              weeklyFinancialSummary: false, weeklyLicensesDue: true, weeklyTopAlerts: true,
              marketplaceUpdates: true, newLoginAlerts: true, largeExpenseAlerts: true,
              projectBudgetWatch: true, profitabilityDipAlerts: true, importantUpdates: true, newMessages: true, invoicePaid: true,
              preferredDigestDay: 'Monday',
          },
          logActiveTime: userProfile.logActiveTime || false,
          passwordChangeDays: userProfile.passwordChangeDays ?? null,
          pinChangeDays: userProfile.pinChangeDays ?? null,
        });
    }
  }, [userProfile, preferencesForm]);


  React.useEffect(() => setMounted(true), []);

  const handleSecurityFeatureAction = async (action: 'enable_pin' | 'disable_pin' | 'change_pin', pin?: string, currentPin?: string) => {
    if (!user) return;
    setIsSecurityActionLoading(true);
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/user-actions/toggle-security-feature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
            body: JSON.stringify({ userId: user.uid, action, pin, currentPin })
        });
        const result = await response.json();
        if(!response.ok) throw new Error(result.message || "An unknown error occurred.");
        
        await refreshContext();
        toast({ title: "Success", description: result.message });
        setIsPinModalOpen(false);
        setIsChangePinModalOpen(false);
    } catch(e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
        setIsSecurityActionLoading(false);
    }
  };

  const handleDataExport = async () => {
    if (!user) return;
    setIsRequestingExport(true);
    toast({ title: "Starting Export...", description: `Preparing your data as a ${exportFormat.toUpperCase()} file.` });
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/user-actions/data-privacy-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({ requestType: 'export', format: exportFormat }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to export data.');
      const result: ExportDataOutput = await response.json();
      const blob = new Blob([Buffer.from(result.fileContent, 'base64')], { type: result.mimeType });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: 'Data Exported', description: 'Your data has been downloaded.' });
    } catch (error: any) {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsRequestingExport(false);
    }
  };

  const handleAccountDeletionRequest = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/user-actions/data-privacy-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ requestType: 'delete' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'An API error occurred.');
      toast({ title: 'Request Submitted', description: result.message, duration: 8000 });
    } catch(error: any) {
      toast({ title: "Operation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeletingAccount(false);
    }
  };
  
  const handlePreferenceSave = async (values: PreferencesFormValues) => {
    if (!user) {
        toast({ title: "Error", description: "You are not authenticated.", variant: "destructive" });
        return;
    }
    setIsSavingPreferences(true);
    try {
        const idToken = await user.getIdToken();
        const payload = {
            notifications: values.notifications,
            logActiveTime: values.logActiveTime,
            passwordChangeDays: values.passwordChangeDays,
            pinChangeDays: values.pinChangeDays,
        };
        const response = await fetch('/api/user-actions/update-preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update preferences.');
        }
        await refreshContext();
        toast({ title: "Success", description: "Preferences have been saved." });
    } catch (error: any) {
        toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsSavingPreferences(false);
    }
  };

  return (
    <>
      <SetupPinDialog isOpen={isPinModalOpen} onOpenChange={setIsPinModalOpen} onConfirm={(pin: string) => handleSecurityFeatureAction('enable_pin', pin)} isProcessing={isSecurityActionLoading} />
      <ChangePinDialog isOpen={isChangePinModalOpen} onOpenChange={setIsChangePinModalOpen} onPinChanged={refreshContext} />
       <div className="space-y-6">
          <div className="flex items-center justify-between">
              <div> 
                  <h1 className="text-2xl font-semibold flex items-center"> 
                      <SettingsIcon className="mr-3 h-7 w-7 text-primary" /> Settings
                  </h1> 
                  <p className="text-muted-foreground"> Manage your account settings and preferences. </p> 
              </div>
          </div>
          <Form {...preferencesForm}>
            <form onSubmit={preferencesForm.handleSubmit(handlePreferenceSave)}>
                <Tabs defaultValue="security" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                    <TabsTrigger value="security" className="flex items-center gap-2"><Shield className="h-4 w-4" />Security</TabsTrigger>
                    <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
                    <TabsTrigger value="appearance" className="flex items-center gap-2"><Palette className="h-4 w-4" />Appearance</TabsTrigger>
                    <TabsTrigger value="data" className="flex items-center gap-2"><Lock className="h-4 w-4" />Data &amp; Privacy</TabsTrigger>
                    </TabsList>
                    <TabsContent value="security" className="mt-4">
                        <SecuritySettingsTabContent 
                            form={preferencesForm}
                            userProfile={userProfile} 
                            appConfig={appConfig} 
                            handleSecurityFeatureAction={handleSecurityFeatureAction} 
                            isSecurityActionLoading={isSecurityActionLoading}
                            setIsChangePinModalOpen={setIsChangePinModalOpen}
                            setIsPinModalOpen={setIsPinModalOpen}
                        />
                    </TabsContent>
                    <TabsContent value="notifications" className="mt-4">
                        <NotificationSettingsTabContent 
                            form={preferencesForm}
                        />
                    </TabsContent>
                    <TabsContent value="appearance" className="mt-4">
                        <AppearanceSettingsTabContent theme={theme} setTheme={setTheme} mounted={mounted}/>
                    </TabsContent>
                    <TabsContent value="data" className="mt-4">
                        <DataPrivacyTabContent 
                            form={preferencesForm}
                            exportFormat={exportFormat}
                            setExportFormat={setExportFormat}
                            handleDataExport={handleDataExport}
                            handleAccountDeletionRequest={handleAccountDeletionRequest}
                            isRequestingExport={isRequestingExport}
                            isDeletingAccount={isDeletingAccount}
                        />
                    </TabsContent>
                </Tabs>
                <Card className="shadow-md mt-6">
                        <CardHeader>
                            <CardTitle>Save Preferences</CardTitle>
                            <CardDescription>
                                Click here to save changes made in all tabs.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button type="submit" disabled={isSavingPreferences}>
                                {isSavingPreferences ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving Preferences...</> : <><Save className="mr-2 h-4 w-4"/>Save All Preferences</>}
                            </Button>
                        </CardFooter>
                </Card>
            </form>
          </Form>
        </div>
    </>
  );
}
