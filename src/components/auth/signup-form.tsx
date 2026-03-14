
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, UserPlus, ShieldCheck, Loader2, ArrowLeft, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLoading } from '@/contexts/loading-context';
import type { sendEmailOtp } from '@/ai/flows/send-email-otp-flow';
import type { verifyOtpAndCreateUser } from '@/ai/flows/verify-otp-and-create-user-flow';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';

const detailsSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }).max(100),
  email: z.string().email({ message: 'Invalid email address.' }),
  countryCode: z.string().min(2, "Required.").max(4).regex(/^\+\d{1,3}$/, "Invalid code"),
  localPhoneNumber: z.string().min(7, "Phone number seems too short.").max(15, "Phone number seems too long.").regex(/^\d+$/, "Invalid phone number."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignUpDetailsValues = z.infer<typeof detailsSchema>;

interface SignUpFormProps {
  sendEmailOtpAction: typeof sendEmailOtp;
  verifyAndCreateUserAction: typeof verifyOtpAndCreateUser;
}

export function SignUpForm({ sendEmailOtpAction, verifyAndCreateUserAction }: SignUpFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { setIsLoading } = useLoading();
  
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [formValues, setFormValues] = useState<SignUpDetailsValues | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timer, setTimer] = useState(600);
  const [canResend, setCanResend] = useState(false);
  const [otp, setOtp] = useState(''); // Direct state for OTP input

  const detailsForm = useForm<SignUpDetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { fullName: "", email: "", countryCode: "+91", localPhoneNumber: "", password: '', confirmPassword: '' },
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp') {
      setTimer(600);
      setCanResend(false);
      interval = setInterval(() => {
        setTimer(prevTimer => {
          if (prevTimer <= 1) {
            clearInterval(interval);
            setCanResend(true);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);
  
  useEffect(() => {
    if (timer <= 540 && !canResend) { 
      setCanResend(true);
    }
  }, [timer, canResend]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const onDetailsSubmit = async (values: SignUpDetailsValues) => {
    setIsSendingOtp(true);
    try {
      const emailResult = await sendEmailOtpAction({ email: values.email });
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }
      toast({ title: "OTP Sent", description: `A verification code has been sent to your email.` });
      setFormValues(values);
      setStep('otp');
    } catch (error: any) {
      toast({ title: "Failed to Send OTP", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  };
  
  const handleOtpVerification = async () => {
    if (!formValues) {
      toast({ title: "Error", description: "Form session expired. Please start over.", variant: "destructive" });
      return;
    }
    if (otp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter a 6-digit OTP.", variant: "destructive" });
      return;
    }
    
    setIsVerifying(true);
    try {
      const fullPhoneNumber = formValues.countryCode && formValues.localPhoneNumber ? `${formValues.countryCode}${formValues.localPhoneNumber}` : null;
      const createResult = await verifyAndCreateUserAction({
        email: formValues.email,
        password: formValues.password,
        fullName: formValues.fullName,
        phoneNumber: fullPhoneNumber,
        emailOtp: otp,
      });

      if (!createResult.success || !createResult.userId) {
        throw new Error(createResult.error || "Verification failed. Please try again.");
      }
      
      toast({ title: "Account Created!", description: "You have been successfully signed up. Please sign in.", duration: 8000 });
      setIsLoading(true);
      router.push('/auth/signin');
    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleResendOtp = async () => {
    if (!formValues?.email || !canResend) return;
    setIsSendingOtp(true);
    try {
      const emailResult = await sendEmailOtpAction({ email: formValues.email });
      if (!emailResult.success) throw new Error(emailResult.message);
      toast({ title: "OTP Resent", description: `A new code has been sent to your email.` });
      setTimer(600);
      setCanResend(false);
    } catch (error: any) {
      toast({ title: "Failed to Resend OTP", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <UserPlus className="mr-2 h-6 w-6" /> {step === 'details' ? 'Create an Account' : 'Verify Your Email'}
        </CardTitle>
        <CardDescription>
          {step === 'details' ? 'Enter your details to get started.' : `Enter the OTP sent to your email. It's valid for 10 minutes.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'details' ? (
          <Form {...detailsForm}>
            <form onSubmit={detailsForm.handleSubmit(onDetailsSubmit)} className="space-y-4">
              <FormField control={detailsForm.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name*</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={detailsForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address*</FormLabel><FormControl><Input type="email" placeholder="your@email.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div>
                <FormLabel>Phone Number</FormLabel>
                <div className="flex items-start space-x-2 mt-1">
                  <FormField
                    control={detailsForm.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem className="w-[80px]">
                        <FormControl>
                          <Input {...field} placeholder="+91" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={detailsForm.control}
                    name="localPhoneNumber"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input type="tel" placeholder="9876543210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <FormField control={detailsForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password*</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={detailsForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirm Password*</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="text-xs text-muted-foreground pt-2">
                By clicking `Send Verification Code`, you agree to our{' '}
                <Link href="/legal/terms-and-conditions" className="underline hover:text-primary" onClick={() => setIsLoading(true)}>
                  Terms & Conditions
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy-policy" className="underline hover:text-primary" onClick={() => setIsLoading(true)}>
                  Privacy Policy
                </Link>
                .
              </div>
              <Button type="submit" className="w-full" disabled={isSendingOtp}>{isSendingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP...</> : <><Send className="mr-2 h-4 w-4" /> Send Verification Code</>}</Button>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="otp-input">Email OTP</Label>
                    <span className="font-mono text-sm text-muted-foreground">{formatTime(timer)}</span>
                </div>
                <div className="flex justify-center">
                    <InputOTP
                        id="otp-input"
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        onComplete={handleOtpVerification}
                    >
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>
                </div>
            </div>
            <Button onClick={handleOtpVerification} className="w-full" disabled={isVerifying || otp.length < 6}>
              {isVerifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                <><ShieldCheck className="mr-2 h-4 w-4" /> Verify & Create Account</>
              )}
            </Button>
            <div className="text-center text-sm">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleResendOtp}
                disabled={!canResend || isSendingOtp}
                className="p-0 h-auto"
              >
                {isSendingOtp ? 'Sending...' : 'Resend OTP'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {step === 'details' ? (
          <div className="text-sm">
            Already have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
                <Link href="/auth/signin" onClick={() => setIsLoading(true)}>Sign In</Link>
            </Button>
          </div>
        ) : (
          <Button variant="link" onClick={() => setStep('details')} className="p-0 h-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Wrong details? Go back
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

    