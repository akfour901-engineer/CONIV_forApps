
'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Loader2, ShieldCheck, Fingerprint } from 'lucide-react';
import Logo from '@/components/layout/pinscreenlogo';
import { Button } from '../ui/button';
import { ResetPinDialog } from './reset-pin-dialog';
import { StartupSplashScreen } from '../layout/startup-splash-screen';

function PinLockScreenContent() {
    const { user, userProfile, verifyPin, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [pin, setPin] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [isResetPinDialogOpen, setIsResetPinDialogOpen] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldRender(true);
        }, 500); // Delay rendering to allow for initial auth checks
        return () => clearTimeout(timer);
    }, []);
    
    const handlePinComplete = async (pin: string) => {
        setIsLoading(true);
        setError("");
        
        const isVerified = verifyPin(pin);

        if (isVerified) {
            toast({
                title: "PIN Verified",
                description: "Access granted.",
            });
            // The isPinVerified state change in the AuthProvider will handle the redirect
        } else {
            setError("Incorrect PIN. Please try again.");
            setPin("");
            setIsLoading(false);
            
            // Shake animation
            const form = document.getElementById('pin-form-container');
            form?.classList.add('animate-shake');
            setTimeout(() => {
                form?.classList.remove('animate-shake');
            }, 500);
        }
    };
    
    const handlePinResetSuccess = () => {
        setIsResetPinDialogOpen(false);
        // We could force a reload or let the user re-enter the new PIN
        // Forcing a reload is simpler and ensures all states are reset cleanly.
        window.location.reload();
    };

    if (loading || !shouldRender) {
        return <StartupSplashScreen message="Verifying security session..." />;
    }
    
    return (
        <>
            <ResetPinDialog 
                isOpen={isResetPinDialogOpen}
                onOpenChange={setIsResetPinDialogOpen}
                onPinReset={handlePinResetSuccess}
            />

            <style jsx global>{`
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
                .animate-shake {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>

            <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 p-4">
                <div id="pin-form-container" className="w-full max-w-sm text-center">
                    <Logo href="#" iconClassName="h-16 w-16 mx-auto mb-4" iconOnly={true} />
                    
                    <h1 className="text-2xl font-semibold text-foreground">Enter Your PIN</h1>
                    <p className="text-muted-foreground text-sm mt-2">
                        Welcome back, {userProfile?.fullName || user?.email}!
                    </p>

                    <div className="flex justify-center my-8">
                        <InputOTP 
                            maxLength={4} 
                            value={pin}
                            onChange={(value) => setPin(value)}
                            onComplete={handlePinComplete}
                            disabled={isLoading}
                        >
                            <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>

                    {error && (
                        <p className="text-destructive text-sm font-medium mb-4 animate-pulse">
                            {error}
                        </p>
                    )}

                    {isLoading && (
                        <div className="flex items-center justify-center text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                        </div>
                    )}
                </div>
                 <Button variant="link" onClick={() => setIsResetPinDialogOpen(true)} className="mt-4 text-xs">
                    Forgot PIN?
                </Button>
            </div>
        </>
    );
}

export function PinVerificationScreen() {
    return (
        <Suspense fallback={<StartupSplashScreen message="Loading Security Module..." />}>
            <PinLockScreenContent />
        </Suspense>
    )
}
