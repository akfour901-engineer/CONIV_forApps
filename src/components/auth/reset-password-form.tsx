
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { SendPasswordResetOtpOutputSchema } from '@/ai/flows/send-password-reset-otp-flow';
import type { VerifyPasswordResetOtpOutputSchema } from '@/ai/flows/verify-password-reset-otp-flow';
import type { ResetPasswordWithTokenOutputSchema } from '@/ai/flows/reset-password-with-token-flow';

const RESEND_COOLDOWN_SECONDS = 60;

const otpSchema = z.object({
  otp: z.string().length(6, "Your one-time password must be 6 characters."),
});
type OtpFormValues = z.infer<typeof otpSchema>;

const newPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long.'),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match.",
  path: ["confirmNewPassword"],
});
type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;

interface ResetPasswordFormProps {
    sendPasswordResetOtpAction: (input: { email: string }) => Promise<z.infer<typeof SendPasswordResetOtpOutputSchema>>;
    verifyOtpAction: (input: { email: string; otp: string }) => Promise<z.infer<typeof VerifyPasswordResetOtpOutputSchema>>;
    resetPasswordAction: (input: { email: string; token: string; newPassword: string }) => Promise<z.infer<typeof ResetPasswordWithTokenOutputSchema>>;
}

export function ResetPasswordForm({ 
    sendPasswordResetOtpAction, 
    verifyOtpAction, 
    resetPasswordAction 
}: ResetPasswordFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [step, setStep] = useState<'otp' | 'new_password'>('otp');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const emailFromUrl = searchParams?.get('email');
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    } else {
        toast({ title: "Error", description: "No email address found. Please start the password reset process again.", variant: "destructive" });
        router.push('/auth/forgot-password');
    }
  }, [searchParams, router, toast]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const handleResendOtp = useCallback(async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    startCooldown();
    try {
      const result = await sendPasswordResetOtpAction({ email });
      toast({ title: "OTP Resent", description: result.message });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setCooldown(0); // Reset cooldown on error
    } finally {
      setIsLoading(false);
    }
  }, [email, sendPasswordResetOtpAction, toast, cooldown]);

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const newPasswordForm = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: "", confirmNewPassword: "" },
  });

  const onOtpSubmit = async (values: OtpFormValues) => {
    setIsLoading(true);
    try {
      const result = await verifyOtpAction({ email, otp: values.otp });
      if (result.success && result.token) {
        setResetToken(result.token);
        setStep('new_password');
        toast({ title: "OTP Verified", description: "You can now set a new password." });
      } else {
        throw new Error(result.error || "Failed to verify OTP.");
      }
    } catch (error: any) {
      otpForm.setError("otp", { type: "manual", message: error.message });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const onNewPasswordSubmit = async (values: NewPasswordFormValues) => {
    setIsLoading(true);
    try {
      const result = await resetPasswordAction({ email, token: resetToken, newPassword: values.newPassword });
      if (result.success) {
        toast({ title: "Success!", description: "Your password has been reset. Please sign in with your new password." });
        router.push('/auth/signin');
      } else {
        throw new Error(result.error || "Failed to reset password.");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  const emailDisplay = email ? ` to ${email}` : '';

  return (
    <Card className="w-full max-w-md shadow-xl">
      {step === 'otp' && (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)}>
            <CardHeader>
              <CardTitle className="text-2xl">Check Your Email</CardTitle>
              <CardDescription>
                We`ve sent a 6-digit OTP{emailDisplay}. Please enter it below to proceed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>One-Time Password</FormLabel>
                    <FormControl>
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} /> <InputOTPSlot index={1} /> <InputOTPSlot index={2} />
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="text-center text-sm">
                Didn`t receive a code?{' '}
                <Button variant="link" type="button" onClick={handleResendOtp} disabled={cooldown > 0} className="p-0 h-auto">
                    Resend {cooldown > 0 && `(in ${cooldown}s)`}
                </Button>
               </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Verifying...</> : <><ShieldCheck className="mr-2 h-4 w-4"/>Verify OTP</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      )}

      {step === 'new_password' && (
        <Form {...newPasswordForm}>
            <form onSubmit={newPasswordForm.handleSubmit(onNewPasswordSubmit)}>
                <CardHeader>
                    <CardTitle className="text-2xl">Set New Password</CardTitle>
                    <CardDescription>
                        Create a strong, new password for your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <FormField
                        control={newPasswordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={newPasswordForm.control}
                        name="confirmNewPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </CardContent>
                 <CardFooter className="flex flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Resetting...</> : <><KeyRound className="mr-2 h-4 w-4"/>Reset Password</>}
                    </Button>
                 </CardFooter>
            </form>
        </Form>
      )}
       <CardFooter className="pt-0">
          <Button variant="link" asChild className="p-0 h-auto w-full">
            <Link href="/auth/signin">
              <ArrowLeft className="mr-2 h-4 w-4"/> Back to Sign In
            </Link>
          </Button>
        </CardFooter>
    </Card>
  );
}
