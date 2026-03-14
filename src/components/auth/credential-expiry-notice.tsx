
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

const passwordChangeSchema = z.object({
  currentPasswordForChange: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(6, "New password must be at least 6 characters."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

export function CredentialExpiryNotice() {
  const { user, userProfile, refreshContext } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordForm = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPasswordForChange: '', newPassword: '', confirmNewPassword: '' },
  });
  
  const handleChangePassword = async (values: z.infer<typeof passwordChangeSchema>) => {
    if (!auth.currentUser || !user?.email) return;
    setIsSubmitting(true);
    const credential = EmailAuthProvider.credential(user.email, values.currentPasswordForChange);
    try {
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, values.newPassword);
      
      // After password update, also reset the policy to 'null' (Never)
      const idToken = await user.getIdToken();
      await fetch('/api/user-actions/update-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ 
            passwordChangeDays: null, // Reset the policy
            pinChangeDays: userProfile?.pinChangeDays, // Preserve existing pin policy
            notifications: userProfile?.notificationPreferences 
        }),
      });

      await refreshContext(); // Refresh context to clear the required flag
      toast({ title: "Password Updated", description: "Your password has been changed successfully. You can now access the dashboard." });
      // The component will unmount as isPasswordChangeRequired becomes false
    } catch (error: any) {
      toast({ title: "Password Update Failed", description: "Incorrect current password or other error.", variant: "destructive" });
      passwordForm.setError("currentPasswordForChange", { type: "manual", message: "Incorrect password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-6 w-6" /> Security Update Required
          </CardTitle>
          <CardDescription>
            Your password has expired according to your account`s security policy. Please update it now to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPasswordForChange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password*</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter your current password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password*</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter your new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password*</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Changing Password...</>
                ) : (
                  <><KeyRound className="mr-2 h-4 w-4" /> Change Password</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
