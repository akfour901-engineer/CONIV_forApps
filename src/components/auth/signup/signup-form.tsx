'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, Loader2, UserPlus, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { SendEmailOtpOutputSchema } from '@/ai/flows/send-email-otp-flow';
import type { VerifyOtpAndCreateUserOutputSchema } from '@/ai/flows/verify-otp-and-create-user-flow';
import { useLoading } from '@/contexts/loading-context';

const MAX_STEPS = 2;

const formSchema = z.object({
  fullName: z.string().min(2, { message: "Full name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phoneNumber: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  otp: z.string().min(6, { message: "Your one-time password must be 6 characters." }),
  agreedToTerms: z.boolean().refine(val => val === true, { message: "You must agree to the terms and conditions." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpFormValues = z.infer<typeof formSchema>;

interface SignUpFormProps {
  sendEmailOtpAction: (input: { email: string }) => Promise<z.infer<typeof SendEmailOtpOutputSchema>>;
  verifyAndCreateUserAction: (input: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string | null;
    emailOtp: string;
  }) => Promise<z.infer<typeof VerifyOtpAndCreateUserOutputSchema>>;
}

export function SignUpForm({ sendEmailOtpAction, verifyAndCreateUserAction }: SignUpFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { setIsLoading } = useLoading();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: "", email: "", phoneNumber: "", password: "", confirmPassword: "", otp: "", agreedToTerms: false },
  });

  const handleNextStep = async () => {
    const fieldsToValidate: (keyof SignUpFormValues)[] = ['fullName', 'email', 'password', 'confirmPassword', 'agreedToTerms'];
    if(form.getValues('phoneNumber')) {
      fieldsToValidate.push('phoneNumber');
    }
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setIsSendingOtp(true);
      try {
        const { success, message } = await sendEmailOtpAction({ email: form.getValues('email') });
        if (!success) throw new Error(message);
        toast({ title: "OTP Sent", description: message });
        setCurrentStep(2);
      } catch (error: any) {
        toast({ title: "Failed to Send OTP", description: error.message, variant: "destructive" });
      } finally {
        setIsSendingOtp(false);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const onSubmit = async (values: SignUpFormValues) => {
    setIsVerifying(true);
    try {
      const result = await verifyAndCreateUserAction({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phoneNumber: values.phoneNumber,
        emailOtp: values.otp,
      });

      if (!result.success || !result.userId) throw new Error(result.error || "An unknown error occurred.");
      
      toast({ title: "Account Created!", description: "You have been successfully signed up. Redirecting you to the dashboard..." });
      
      // Store a flag in sessionStorage to show the onboarding modal
      sessionStorage.setItem('isNewUser', 'true');
      
      setIsLoading(true);
      router.push('/dashboard');
    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };


  return (
    <Card className="w-full max-w-md shadow-xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <UserPlus className="mr-2 h-6 w-6"/>Create an Account
            </CardTitle>
            <CardDescription>Step {currentStep} of {MAX_STEPS}: {currentStep === 1 ? 'Enter your details' : 'Verify your email'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div style={{ display: currentStep === 1 ? 'block' : 'none' }} className="space-y-4">
               <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name*</FormLabel><FormControl><Input placeholder="Name..." {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address*</FormLabel><FormControl><Input type="email" placeholder="your@email.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="+91 98765 43210" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password*</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirm Password*</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField
                control={form.control}
                name="agreedToTerms"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>Agree to terms and conditions</FormLabel>
                        <FormDescription>
                        You agree to our <Link href="/legal/terms-and-conditions" className="underline" target="_blank">Terms</Link> and <Link href="/legal/privacy-policy" className="underline" target="_blank">Privacy Policy</Link>.
                        </FormDescription>
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormDescription>Please enter the 6-digit code sent to your email.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            {currentStep === 1 && <Button type="button" className="w-full" onClick={handleNextStep} disabled={isSendingOtp}>{isSendingOtp ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Sending OTP...</>) : (<><Mail className="mr-2 h-4 w-4"/>Send Verification Code</>)}</Button>}
            {currentStep === 2 && (
              <div className="w-full flex flex-col gap-2">
                 <Button type="submit" className="w-full" disabled={isVerifying}>{isVerifying ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Verifying...</>) : (<><ShieldCheck className="mr-2 h-4 w-4"/>Verify & Create Account</>)}</Button>
                 <Button type="button" variant="outline" className="w-full" onClick={handlePreviousStep}>Back</Button>
              </div>
            )}
             <div className="text-sm mt-4">
              Already have an account?{' '}
              <Button variant="link" asChild className="p-0 h-auto" onClick={() => setIsLoading(true)}>
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
