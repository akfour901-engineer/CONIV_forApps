'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, X } from 'lucide-react';

interface PinInputDialogProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: (pin: string) => void;
  onSetupComplete?: () => void; // New prop for when the PIN is set successfully
  isProcessing?: boolean;
  showCancelButton?: boolean;
}

const pinSchema = z.object({
  pin: z.string().min(4, "PIN must be 4 digits.").max(4, "PIN must be 4 digits.").regex(/^\d{4}$/, "PIN must be 4 digits."),
  confirmPin: z.string(),
}).refine(data => data.pin === data.confirmPin, {
  message: "PINs do not match.",
  path: ["confirmPin"],
});

type PinFormValues = z.infer<typeof pinSchema>;

export function SetupPinDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  onSetupComplete,
  isProcessing = false,
  showCancelButton = true
}: PinInputDialogProps) {
  const form = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "", confirmPin: "" },
  });

  const onSubmit = (values: PinFormValues) => {
    if (onConfirm) {
      onConfirm(values.pin);
    }
    if (onSetupComplete) {
      // Here, you'd typically call a server action to save the PIN.
      // For this example, we'll simulate it and then call the callback.
      // In a real app: await savePinAction(values.pin);
      onSetupComplete();
    }
  };
  
  const content = (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>New 4-Digit PIN</FormLabel>
                    <FormControl>
                    <Input type="password" inputMode="numeric" maxLength={4} {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="confirmPin"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Confirm New PIN</FormLabel>
                    <FormControl>
                    <Input type="password" inputMode="numeric" maxLength={4} {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <DialogFooter className="pt-4">
                {showCancelButton && onOpenChange && (
                    <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isProcessing}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    </DialogClose>
                )}
                <Button type="submit" disabled={isProcessing}>
                    {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Set PIN</>}
                </Button>
            </DialogFooter>
        </form>
    </Form>
  );

  // If used as a standalone component inside another dialog (like onboarding)
  if (isOpen === undefined) {
      return content;
  }

  // If used as a typical pop-up dialog
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Up Your App PIN</DialogTitle>
          <DialogDescription>
            This 4-digit PIN will be required to open the application, adding an extra layer of security.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
