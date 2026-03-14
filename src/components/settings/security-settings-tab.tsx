
'use client';

import { useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { UserProfile, AppConfiguration } from '@/types/server-only';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuthContext } from '@/firebase';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters long.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character.'),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;

interface SecuritySettingsTabContentProps {
  userProfile: UserProfile;
  appConfig: AppConfiguration | null;
  handleSecurityFeatureAction: (action: 'enable_pin' | 'disable_pin' | 'change_pin', pin?: string, currentPin?: string) => Promise<void>;
  isSecurityActionLoading: boolean;
  setIsChangePinModalOpen: (isOpen: boolean) => void;
  setIsPinModalOpen: (isOpen: boolean) => void;
  form: UseFormReturn<any>;
}

export function SecuritySettingsTabContent({
  userProfile,
  appConfig,
  handleSecurityFeatureAction,
  isSecurityActionLoading,
  setIsChangePinModalOpen,
  setIsPinModalOpen,
  form,
}: SecuritySettingsTabContentProps) {
  const { user } = useAuth();
  const auth = useAuthContext();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  const handleChangePassword = async (values: PasswordChangeFormValues) => {
    if (!auth?.currentUser || !user?.email) return;
    setIsChangingPassword(true);
    const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
    try {
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, values.newPassword);
      passwordForm.reset();
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
    } catch (error: any) {
      toast({ title: "Password Update Failed", description: "Incorrect current password or other error.", variant: "destructive" });
      passwordForm.setError("currentPassword", { type: "manual", message: "Incorrect password." });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const securityFeatureCost = (key: string): number => {
    return appConfig?.actionCosts?.find((c: any) => c.key === key)?.cost ?? 0;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>App Security Features</CardTitle>
          <CardDescription>Enhance your account`s security with additional measures.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-md font-medium mb-1 flex items-center gap-2">App PIN Lock</h3>
            <p className="text-sm text-muted-foreground mb-2">Require a 4-digit PIN to open the app for an extra layer of security on shared devices.</p>
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-md bg-secondary/50">
              <p className="text-sm">Status: <span className={cn("font-semibold", userProfile.isPinEnabled ? "text-green-600" : "text-orange-600")}>{userProfile.isPinEnabled ? "Enabled" : "Disabled"}</span></p>
              <div className="flex gap-2">
                {userProfile.isPinEnabled ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setIsChangePinModalOpen(true)} disabled={isSecurityActionLoading}>Change PIN</Button>
                    <Button variant="outline" size="sm" onClick={() => handleSecurityFeatureAction('disable_pin')} disabled={isSecurityActionLoading}>{isSecurityActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Disable PIN Lock</Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setIsPinModalOpen(true)} disabled={isSecurityActionLoading}>
                    {isSecurityActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Enable PIN Lock ({securityFeatureCost('PIN_SETUP_COST')} Points)
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (<FormItem><FormLabel>Current Password*</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (<FormItem><FormLabel>New Password*</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={passwordForm.control} name="confirmNewPassword" render={({ field }) => (<FormItem><FormLabel>Confirm New Password*</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" disabled={isChangingPassword}>{isChangingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Changing...</> : <><KeyRound className="mr-2 h-4 w-4" />Change Password</>}</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
