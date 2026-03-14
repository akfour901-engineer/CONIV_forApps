'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { SetupPinDialog } from '@/components/settings/pin-input-dialog';
import { NotificationSettingsTabContent } from '@/components/settings/notification-settings-tab';
import { useAuth } from '@/hooks/use-auth';
import { ArrowRight, Bell, KeyRound, PartyPopper } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '../ui/form';
import { useRouter } from 'next/navigation';

interface OnboardingModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export function OnboardingModal({ isOpen, onOpenChange }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const { user, userProfile, refreshContext } = useAuth();
  const router = useRouter();

  const form = useForm<PreferencesFormValues>({
      resolver: zodResolver(preferencesSchema),
      defaultValues: {
          notifications: userProfile?.notificationPreferences || undefined
      }
  });

  const handlePinSetupComplete = async () => {
    await refreshContext();
    setStep(3); // Move to notifications step
  };

  const handleGoToSettings = () => {
    router.push('/dashboard/settings');
    onOpenChange(false);
  };

  const steps = [
    {
      title: "Welcome to CONIV!",
      icon: PartyPopper,
      description: "Let's quickly set up a few things to enhance your experience and security.",
      content: <p>We`ll guide you through setting a security PIN and configuring your notification preferences.</p>,
      nextButton: "Let's Go!",
      onNext: () => setStep(2),
    },
    {
      title: "Set Up Your Security PIN",
      icon: KeyRound,
      description: "Add an extra layer of security to your account by setting a 4-digit PIN. This will be required to open the app.",
      content: <SetupPinDialog onSetupComplete={handlePinSetupComplete} showCancelButton={false} />,
      nextButton: "Skip for Now", // This is a fallback if the dialog's own buttons are not used
      onNext: () => setStep(3),
    },
    {
      title: "Notification Preferences",
      icon: Bell,
      description: "Stay updated with important events. You can customize these settings in detail later.",
      content: (
          <Form {...form}>
              <form><NotificationSettingsTabContent form={form} /></form>
          </Form>
      ),
      nextButton: "Go to Dashboard",
      onNext: () => onOpenChange(false),
      onSaveAndContinue: handleGoToSettings,
    },
  ];

  const currentStep = steps[step - 1];

  // The PIN setup step has its own internal buttons, so we don't render the modal footer for it.
  const showFooter = step !== 2;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
              <currentStep.icon className="mr-2 h-5 w-5 text-primary" />
              {currentStep.title}
          </DialogTitle>
          <DialogDescription>{currentStep.description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 border-y">
            {currentStep.content}
        </div>
        {showFooter && (
          <DialogFooter className="pt-4 border-t">
            {step === 3 ? (
                <Button onClick={handleGoToSettings}>
                    Save & Go to Settings <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            ) : (
                <Button onClick={currentStep.onNext}>
                    {currentStep.nextButton} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
