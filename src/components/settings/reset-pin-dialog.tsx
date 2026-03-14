
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
import { Save, Loader2, X, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Label } from '@/components/ui/label';

interface ResetPinDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPinReset: () => void;
}

const passwordAuthSchema = z.object({
  password: z.string().min(1, "Password is required."),
});

// We will handle the new PIN logic with local state to avoid form library issues.
type PasswordAuthFormValues = z.infer<typeof passwordAuthSchema>;

export function ResetPinDialog({ isOpen, onOpenChange, onPinReset }: ResetPinDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'password' | 'new_pin'>('password');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Use local state for PIN fields to ensure they are always controlled.
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const passwordForm = useForm<PasswordAuthFormValues>({
    resolver: zodResolver(passwordAuthSchema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (isOpen) {
      setStep('password');
      passwordForm.reset({ password: "" });
      setNewPin('');
      setConfirmNewPin('');
      setPinError(null);
    }
  }, [isOpen, passwordForm]);

  const handlePasswordSubmit = async (values: PasswordAuthFormValues) => {
    if (!user?.email) return;
    setIsProcessing(true);
    try {
        const credential = EmailAuthProvider.credential(user.email, values.password);
        await reauthenticateWithCredential(user, credential);
        toast({ title: "Password Verified", description: "You can now set a new PIN." });
        setStep('new_pin');
    } catch (error) {
        toast({ title: "Authentication Failed", description: "The password you entered is incorrect.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleNewPinSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        setPinError("PIN must be 4 digits.");
        return;
      }
      if (newPin !== confirmNewPin) {
        setPinError("New PINs do not match.");
        return;
      }
      setPinError(null);

      if(!user) return;
      setIsProcessing(true);
      try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/user-actions/toggle-security-feature', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
              body: JSON.stringify({ userId: user.uid, action: 'reset_pin', pin: newPin })
          });
          const result = await response.json();
          if(!response.ok) throw new Error(result.message || "An unknown error occurred.");
          
          toast({ title: "Success", description: "Your PIN has been reset." });
          onPinReset();
      } catch(e: any) {
          toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'password' ? 'Forgot PIN - Verify Password' : 'Set New PIN'}</DialogTitle>
          <DialogDescription>
            {step === 'password' 
              ? 'To reset your PIN, please enter your main account password first.'
              : 'Please enter and confirm your new 4-digit PIN.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'password' ? (
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4 py-2">
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="Enter your password" autoComplete="current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isProcessing}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isProcessing}>{isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Verify Password</>}</Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <form onSubmit={handleNewPinSubmit} className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-pin-input">New 4-Digit PIN</Label>
              <Input
                id="new-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="confirm-new-pin-input">Confirm New PIN</Label>
              <Input
                id="confirm-new-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value)}
                autoComplete="new-password"
              />
            </div>
             {pinError && <p className="text-sm font-medium text-destructive">{pinError}</p>}
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isProcessing}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isProcessing}>{isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Set New PIN</>}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
