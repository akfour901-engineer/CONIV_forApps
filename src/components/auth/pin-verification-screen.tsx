
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import Logo from '@/components/layout/pinscreenlogo';
import { APP_NAME } from '@/lib/constants';
import { ResetPinDialog } from '@/components/settings/reset-pin-dialog';
import { Power } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';


export function PinVerificationScreen() {
  const { verifyPin } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isResetPinDialogOpen, setIsResetPinDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handlePinChange = (value: string) => {
    setPin(value);
    if (error) {
      setError('');
    }
  };

  const handlePinComplete = (value: string) => {
    if (verifyPin(value)) {
      // The auth context will handle showing the app content
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin(''); // Reset pin on error
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out" });
      router.push('/auth/signin');
    } catch (error) {
      toast({ title: "Logout Failed", variant: "destructive" });
    }
  };

  return (
    <>
      <ResetPinDialog 
        isOpen={isResetPinDialogOpen} 
        onOpenChange={setIsResetPinDialogOpen}
        onPinReset={() => {
          setIsResetPinDialogOpen(false);
        }}
      />
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center justify-center mb-8">
            <Logo
              href="#"
              iconClassName="h-20 w-20 text-primary"
            />
             <h1 className="text-2xl font-bold tracking-tighter text-primary mt-2">{APP_NAME}</h1>
          </div>
          
          <div className="space-y-4 text-center">
            <h1 className="text-xl font-semibold">Enter Your PIN</h1>
            <p className="text-sm text-muted-foreground">
              Please enter your 4-digit PIN to unlock the application.
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={4}
                value={pin}
                onChange={handlePinChange}
                onComplete={handlePinComplete}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

             <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="link" size="sm" onClick={() => setIsResetPinDialogOpen(true)}>
                    Forgot PIN?
                </Button>
                <Button variant="link" size="sm" onClick={handleLogout} className="text-muted-foreground">
                    <Power className="mr-2 h-4 w-4"/> Log Out
                </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
