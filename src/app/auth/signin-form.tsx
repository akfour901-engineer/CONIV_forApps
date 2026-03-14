
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
import { LogIn, Loader2, WifiOff, ShieldAlert, Mail, Phone, ArrowLeft } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLoading } from '@/contexts/loading-context';

const firestorePermissionErrorTitle = "Sign In Error - Firestore Rules";
const firestorePermissionErrorDescription = "Your Firestore security rules are BLOCKING the phone number lookup. The exact query that failed is logged in your browser's developer console (e.g., \"Firestore Permission Denied: Failed to query 'users' where 'phoneNumber' == '...' with limit(1)\").\n\n**CRITICAL: You MUST verify your PUBLISHED Firestore rules in the Firebase Console.**\n1. Go to Firebase Console -> Firestore Database -> Rules.\n2. Ensure a rule allowing this query for UNAUTHENTICATED users is present and PUBLISHED. The rule should look like:\n   `match /users/{document=**} { allow list: if request.auth == null && request.query.limit == 1 && request.query.wheres.size() == 1 && (request.query.wheres[0][0] == \"phoneNumber\" || request.query.wheres[0][0] == \"email\"); }`\n3. Use the Firebase Console **Rules Simulator**: Simulate as UNAUTHENTICATED, path `/users`, method `list` (or `get` on collection), with query `limit = 1` AND `where phoneNumber == [EXACT_LOGGED_PHONE_FROM_CONSOLE]`. The simulator will show why it's denied.\n4. **For DEBUGGING ONLY if the above rule fails**: Try this SIMPLER, LESS SECURE rule temporarily: `match /users/{document=**} { allow list: if request.auth == null && request.query.limit == 1 && request.query.wheres.size() >= 1; }`. If this works, the issue is with the field check in the more secure rule. Revert to the secure rule ASAP.\n\nA Cloud Function is a more secure long-term solution for this lookup.";


const networkErrorTitle = "Network Connection Issue";
const networkErrorDescription = "Failed to connect to Firebase services. Please: \n1. **Check your internet connection.** \n2. **Verify your Firebase configuration in `.env.local` files is correct** (API Key, Project ID, Auth Domain). Incorrect config can cause network errors when contacting Firebase/Google services. \n3. Ensure no firewalls or browser extensions are blocking requests to Google/Firebase domains. \n4. Try refreshing the page or restarting your browser.";


const formSchema = z.object({
  signInMethod: z.enum(['email', 'phone']).default('email'),
  email: z.string().optional().or(z.literal('')),
  countryCode: z.string().optional().or(z.literal('')),
  localPhoneNumber: z.string().optional().or(z.literal('')),
  password: z.string().min(1, { message: 'Password is required.' }),
}).superRefine((data, ctx) => {
  if (data.signInMethod === 'email') {
    if (!data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required for email sign-in.",
        path: ["email"],
      });
    } else if (!z.string().email().safeParse(data.email).success) {
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid email address.",
        path: ["email"],
      });
    }
  } else if (data.signInMethod === 'phone') {
    if (!data.countryCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Country code is required.",
        path: ["countryCode"],
      });
    } else if (!/^\\+\\d{1,3}$/.test(data.countryCode)) { 
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid country code (e.g., +91).",
        path: ["countryCode"],
      });
    }
    if (!data.localPhoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Local phone number is required.",
        path: ["localPhoneNumber"],
      });
    } else if (!/^\\d{7,15}$/.test(data.localPhoneNumber)) { 
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number must be 7-15 digits.",
        path: ["localPhoneNumber"],
      });
    }
  }
});

type SignInFormValues = z.infer<typeof formSchema>;

export function SignInForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setIsLoading } = useLoading();
  const [showNetworkError, setShowNetworkError] = useState(false);
  const [showPermissionError, setShowPermissionError] = useState(false);

  const form = useForm<SignInFormValues>({
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
    setShowPermissionError(false);
  };

  const handleMethodChange = (value: 'email' | 'phone') => {
    const currentValues = form.getValues();
    form.reset({
        password: currentValues.password,
        signInMethod: value,
        email: value === 'email' ? currentValues.email || '' : '',
        countryCode: value === 'phone' ? currentValues.countryCode || '+91' : '+91',
        localPhoneNumber: value === 'phone' ? currentValues.localPhoneNumber || '' : '',
    }, { keepDefaultValues: false, keepErrors: false });
    form.clearErrors();
    resetErrorStates();
  };

  const onSubmit = async (values: SignInFormValues) => {
    const submissionId = Date.now();
    console.log(`SignInForm (${submissionId}): onSubmit called with values:`, values);
    setIsSubmitting(true);
    resetErrorStates();

    if (!auth || !db) {
      console.error(`SignInForm (${submissionId}): Firebase auth or db service is not available. Check firebase.ts and .env.local configuration.`);
      toast({
        title: "Configuration Error",
        description: "Firebase services are not available. Please check console.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    let userEmailToAuth = '';
    let fullPhoneNumberForQuery = '';

    try {
      if (values.signInMethod === 'phone') {
        fullPhoneNumberForQuery = (values.countryCode || '') + (values.localPhoneNumber || '');
        console.log(`SignInForm: Attempting to look up phone number in Firestore: ${fullPhoneNumberForQuery}. Use this exact string in Firestore Rules Simulator with limit(1) and where clause on 'phoneNumber'.`);

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("phoneNumber", "==", fullPhoneNumberForQuery), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          toast({ title: "Sign In Failed", description: "No account found with this phone number.", variant: "destructive" });
          form.setError("localPhoneNumber", { type: "manual", message: "Phone number not registered." });
          setIsSubmitting(false);
          return;
        }
        const userDocData = querySnapshot.docs[0].data();
        if (!userDocData.email) {
          toast({ title: "Sign In Failed", description: "Associated account does not have an email. Please contact support.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        userEmailToAuth = userDocData.email;
        console.log(`SignInForm (${submissionId}): Found email for phone number ${fullPhoneNumberForQuery}: ${userEmailToAuth}`);
      } else {
        userEmailToAuth = values.email || '';
      }
      
      if (!userEmailToAuth) {
        toast({ title: "Input Error", description: "Email is required for sign-in.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      console.log(`SignInForm (${submissionId}): Attempting Firebase sign in with email:`, userEmailToAuth);
      const userCredential = await signInWithEmailAndPassword(auth, userEmailToAuth, values.password);
      const user = userCredential.user;

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          lastLogin: new Date().toISOString(),
        });
      }

      toast({ title: "Sign In Successful", description: "Welcome back!" });
      setIsLoading(true);
      router.push('/dashboard');

    } catch (error: any) {
      console.error(`SignInForm (${submissionId}): Sign in error:`, error);
      console.error(`SignInForm (${submissionId}): Detailed sign-in error object:`, JSON.parse(JSON.stringify(error))); 

      if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
        console.error(`Firestore Permission Denied: Failed to query 'users' collection where 'phoneNumber' == '${fullPhoneNumberForQuery}' with limit(1). Check unauthenticated access rules.`);
        setShowPermissionError(true);
        toast({
            title: firestorePermissionErrorTitle,
            description: firestorePermissionErrorDescription,
            variant: "destructive",
            duration: 60000, 
        });
      } else if (error.code === 'auth/network-request-failed') {
        console.error(`SignInForm (${submissionId}): Caught 'auth/network-request-failed' during sign-in.`);
        setShowNetworkError(true);
         toast({
            title: networkErrorTitle,
            description: networkErrorDescription,
            variant: "destructive",
            duration: 30000,
        });
      } else if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/invalid-email'
      ) {
        toast({
          title: "Sign In Failed",
          description: "Invalid credentials. Please check your email/phone and password.",
          variant: "destructive",
        });
        if (values.signInMethod === 'email' && values.email) {
            form.setError("email", { type: "manual", message: "Incorrect email or password." });
        } else if (values.signInMethod === 'phone' && values.localPhoneNumber) {
            form.setError("localPhoneNumber", { type: "manual", message: "Password incorrect for this phone number, or phone not found." });
        }
        form.setError("password", { type: "manual", message: " " }); 
      } else {
        toast({
          title: "Sign In Failed",
          description: error.message || "An unexpected error occurred. Please try again.",
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
        <CardDescription>Select your sign-in method: Email or Phone Number.</CardDescription>
      </CardHeader>
      <CardContent>
        {showNetworkError && (
          <Alert variant="destructive" className="mb-4">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>{networkErrorTitle}</AlertTitle>
            <AlertDescription>{networkErrorDescription}</AlertDescription>
          </Alert>
        )}
        {showPermissionError && (
          <Alert variant="destructive" className="mb-4 whitespace-pre-line">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{firestorePermissionErrorTitle}</AlertTitle>
            <AlertDescription>{firestorePermissionErrorDescription}</AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="signInMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Sign-in Method</FormLabel>
                   <FormControl>
                      <RadioGroup
                        onValueChange={(value) => handleMethodChange(value as 'email' | 'phone')}
                        value={field.value}
                        className="flex space-x-4"
                      >
                          <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                  <RadioGroupItem value="email" id="emailMethod" />
                              </FormControl>
                              <Label htmlFor="emailMethod" className="flex items-center cursor-pointer font-normal">
                                  <Mail className="mr-2 h-4 w-4" /> Email
                              </Label>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                  <RadioGroupItem value="phone" id="phoneMethod" />
                              </FormControl>
                              <Label htmlFor="phoneMethod" className="flex items-center cursor-pointer font-normal">
                                  <Phone className="mr-2 h-4 w-4" /> Phone
                              </Label>
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
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="your@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentSignInMethod === 'phone' && (
              <div>
                <FormLabel htmlFor="localPhoneNumberInput">Phone Number</FormLabel>
                <div className="flex items-start space-x-2 mt-1">
                  <FormField
                    control={form.control}
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
                    control={form.control}
                    name="localPhoneNumber"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input id="localPhoneNumberInput" type="tel" placeholder="9876543210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                    <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Button variant="link" asChild className="p-0 h-auto text-xs">
                          <Link href="/auth/forgot-password" onClick={() => setIsLoading(true)}>Forgot Password?</Link>
                        </Button>
                    </div>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting || showNetworkError || showPermissionError}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...
                </>
              ) : (
                 "Sign In"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-2">
        <div className="text-sm">
          Don`t have an account?{' '}
          <Button variant="link" asChild className="p-0 h-auto">
            <Link href="/auth/signup" onClick={() => setIsLoading(true)}>Sign Up</Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
