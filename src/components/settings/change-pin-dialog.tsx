
'use client';

import { useState, useEffect } from 'react';
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
import { Save, Loader2, X, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface ChangePinDialogProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPinChanged?: () => void; // A new callback to notify parent when PIN is successfully changed
}

const changePinSchema = z.object({
  currentPin: z.string().min(4, "PIN must be 4 digits.").max(4, "PIN must be 4 digits.").regex(/^\d{4}$/, "PIN must be 4 digits."),
  newPin: z.string().min(4, "New PIN must be 4 digits.").max(4, "New PIN must be 4 digits.").regex(/^\d{4}$/, "PIN must be 4 digits."),
  confirmNewPin: z.string(),
}).refine(data => data.newPin === data.confirmNewPin, {
  message: "New PINs do not match.",
  path: ["confirmNewPin"],
}).refine(data => data.currentPin !== data.newPin, {
  message: "New PIN must be different from the current PIN.",
  path: ["newPin"],
});

type ChangePinFormValues = z.infer<typeof changePinSchema>;

// This component can be used in two ways:
// 1. As a standalone dialog (props.isOpen and onOpenChange provided)
// 2. Embedded within another component (props.isOpen/onOpenChange are undefined)
export function ChangePinDialog({
  isOpen,
  onOpenChange,
  onPinChanged,
}: ChangePinDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<ChangePinFormValues>({
    resolver: zodResolver(changePinSchema),
    defaultValues: { currentPin: "", newPin: "", confirmNewPin: "" },
  });

  const handleSecurityFeatureAction = async (action: 'change_pin', pin?: string, currentPin?: string) => {
    if(!user) return;
    setIsProcessing(true);
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/user-actions/toggle-security-feature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
            body: JSON.stringify({ userId: user.uid, action, pin, currentPin })
        });
        const result = await response.json();
        if(!response.ok) throw new Error(result.message || "An unknown error occurred.");
        
        toast({ title: "Success", description: result.message });
        if (onPinChanged) onPinChanged();
        else if (onOpenChange) onOpenChange(false); // Close dialog if standalone
    } catch(e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
        if (e.message.toLowerCase().includes('incorrect current pin')) {
            form.setError("currentPin", { type: "manual", message: "Incorrect current PIN." });
        }
    } finally {
        setIsProcessing(false);
    }
  };
  
  const onSubmit = (values: ChangePinFormValues) => {
    handleSecurityFeatureAction('change_pin', values.newPin, values.currentPin);
  };
  
  useEffect(() => {
    if(!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const content = (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <FormField
            control={form.control}
            name="currentPin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current PIN</FormLabel>
                <FormControl>
                  <Input type="password" inputMode="numeric" maxLength={4} {...field} autoComplete="off" placeholder="Enter your current 4-digit PIN"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="newPin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New 4-Digit PIN</FormLabel>
                <FormControl>
                  <Input type="password" inputMode="numeric" maxLength={4} {...field} autoComplete="new-password" placeholder="Enter your new PIN"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmNewPin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New PIN</FormLabel>
                <FormControl>
                  <Input type="password" inputMode="numeric" maxLength={4} {...field} autoComplete="new-password" placeholder="Confirm your new PIN"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter className="pt-4">
            {onOpenChange && <DialogClose asChild><Button type="button" variant="outline" disabled={isProcessing}><X className="mr-2 h-4 w-4" /> Cancel</Button></DialogClose>}
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : <><KeyRound className="mr-2 h-4 w-4" /> Change PIN</>}
            </Button>
          </DialogFooter>
        </form>
      </Form>
  );

  if (isOpen !== undefined && onOpenChange) {
      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Your App PIN</DialogTitle>
              <DialogDescription>
                Enter your current PIN and set a new one.
              </DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      );
  }

  return content;
}
