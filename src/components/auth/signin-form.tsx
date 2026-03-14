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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2, WifiOff, ShieldAlert, Mail, Phone } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLoading } from '@/contexts/loading-context';

const SHORT_NETWORK_ERROR = "Cannot connect to the server. Please check your internet connection and try again.";
const SHORT_PERMISSION_ERROR = "Service temporarily unavailable. Please try again later.";
const SHORT_UNEXPECTED_ERROR = "Something went wrong. Please try again.";

export function SignInForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setIsLoading } = useLoading();
  const [showNetworkError, setShowNetworkError] = useState(false);
  const [showServiceError, setShowServiceError] = useState(false);


  const formSchema = z.object({
    signInMethod: z.enum(['email', 'phone']),
    email: z.string().optional(),
    countryCode: z.string().optional(),
    localPhoneNumber: z.string().optional(),
    password: z.string().min(1, { message: "Password is required" }),
  }).superRefine((data, ctx) => {
    if (data.signInMethod === 'email') {
      if (!data.email?.trim()) {
        ctx.addIssue({ code: "custom", message: "Email is required", path: ["email"] });
      } else if (!z.string().email().safeParse(data.email).success) {
        ctx.addIssue({ code: "custom", message: "Invalid email", path: ["email"] });
      }
    } else {
      if (!data.countryCode?.trim()) {
        ctx.addIssue({ code: "custom", message: "Country code required", path: ["countryCode"] });
      } else if (!/^\+\d{1,4}$/.test(data.countryCode)) {
        ctx.addIssue({ code: "custom", message: "Invalid country code", path: ["countryCode"] });
      }
      if (!data.localPhoneNumber?.trim()) {
        ctx.addIssue({ code: "custom", message: "Phone number required", path: ["localPhoneNumber"] });
      } else if (!/^\d{7,15}$/.test(data.localPhoneNumber)) {
        ctx.addIssue({ code: "custom", message: "Invalid phone number", path: ["localPhoneNumber"] });
      }
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      signInMethod: 'email',
      email: '',
      countryCode: '+91',
      localPhoneNumber: '',
      password: '',
    },
  });

  const currentSignInMethod = form.watch('signInMethod');

  const resetErrorStates = () => {
    setShowNetworkError(false);
    setShowServiceError(false);
  };

  const handleMethodChange = (value: 'email' | 'phone') => {
    const current = form.getValues();
    form.reset({
      password: current.password,
      signInMethod: value,
      email: value === 'email' ? current.email || '' : '',
      countryCode: value === 'phone' ? current.countryCode || '+91' : '',
      localPhoneNumber: value === 'phone' ? current.localPhoneNumber || '' : '',
    }, { keepDefaultValues: false, keepErrors: false });
    form.clearErrors();
    resetErrorStates();
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const submissionId = Date.now();
    setIsSubmitting(true);
    resetErrorStates();

    if (!auth || !db) {
      console.error("Firebase not initialized properly");
      toast({ title: "Service Error", description: SHORT_UNEXPECTED_ERROR, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    let emailToUse = '';

    try {
      if (values.signInMethod === 'phone') {
        const fullPhone = (values.countryCode || '') + (values.localPhoneNumber || '');

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("phoneNumber", "==", fullPhone), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          toast({ title: "Sign In Failed", description: "No account found with this phone number.", variant: "destructive" });
          form.setError("localPhoneNumber", { message: "Phone number not registered." });
          setIsSubmitting(false);
          return;
        }

        const userData = snap.docs[0].data();
        if (!userData.email) {
          toast({ title: "Sign In Failed", description: "Account issue. Please contact support.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        emailToUse = userData.email;
      } else {
        emailToUse = values.email || '';
      }

      if (!emailToUse) {
        toast({ title: "Error", description: "Email is required.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, values.password);
      const user = userCredential.user;

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          lastLogin: new Date().toISOString(),
        });
      }

      toast({ title: "Welcome back!", description: "Signed in successfully." });
      setIsLoading(true);
      router.push('/dashboard');

    } catch (error: any) {
      console.error("Sign-in error:", error?.code, error?.message);

      if (error.code === 'auth/network-request-failed') {
        setShowNetworkError(true);
        toast({
          title: "Connection Issue",
          description: SHORT_NETWORK_ERROR,
          variant: "destructive",
          duration: 12000,
        });
      } else if (error.code === 'permission-denied') {
        setShowServiceError(true);
        toast({
          title: "Service Issue",
          description: SHORT_PERMISSION_ERROR,
          variant: "destructive",
          duration: 8000,
        });
      } else if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/invalid-email'
      ) {
        toast({
          title: "Sign In Failed",
          description: "Incorrect email/phone or password.",
          variant: "destructive",
        });

        if (values.signInMethod === 'email') {
          form.setError("email", { message: " " });
        } else {
          form.setError("localPhoneNumber", { message: " " });
        }
        form.setError("password", { message: " " });
      } else {
        toast({
          title: "Error",
          description: SHORT_UNEXPECTED_ERROR,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };





  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <LogIn className="mr-2 h-6 w-6" /> Sign In
        </CardTitle>
        <CardDescription>Choose how you`d like to sign in</CardDescription>
      </CardHeader>

      <CardContent>
        {showNetworkError && (
          <Alert variant="destructive" className="mb-5">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Connection Problem</AlertTitle>
            <AlertDescription>{SHORT_NETWORK_ERROR}</AlertDescription>
          </Alert>
        )}

        {showServiceError && (
          <Alert variant="destructive" className="mb-5">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Service Issue</AlertTitle>
            <AlertDescription>{SHORT_PERMISSION_ERROR}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="signInMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Sign in with</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(v) => handleMethodChange(v as 'email' | 'phone')}
                      value={field.value}
                      className="flex space-x-6"
                    >
                      <FormItem className="flex items-center space-x-2">
                        <FormControl><RadioGroupItem value="email" id="email" /></FormControl>
                        <Label htmlFor="email" className="cursor-pointer"><Mail className="inline mr-1.5 h-4 w-4" />Email</Label>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2">
                        <FormControl><RadioGroupItem value="phone" id="phone" /></FormControl>
                        <Label htmlFor="phone" className="cursor-pointer"><Phone className="inline mr-1.5 h-4 w-4" />Phone</Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {currentSignInMethod === 'email' && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentSignInMethod === 'phone' && (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem className="w-20">
                        <FormControl>
                          <Input placeholder="+91" {...field} maxLength={5} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
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
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Password</FormLabel>
                    <Button variant="link" size="sm" className="px-0 h-auto text-xs" asChild>
                      <Link href="/auth/forgot-password">Forgot password?</Link>
                    </Button>
                  </div>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || showNetworkError || showServiceError}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>

      <CardFooter className="flex justify-center text-sm">
        Don`t have an account?{' '}
        <Button variant="link" className="px-1.5 h-auto" asChild>
          <Link href="/auth/signup">Sign up</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}