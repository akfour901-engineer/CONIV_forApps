
'use client';

import type { ReactNode } from 'react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { StartupSplashScreen } from './startup-splash-screen';
import { PinVerificationScreen } from '@/components/auth/pin-verification-screen';
import { useRouter } from 'next/navigation';
import { usePathname, useSearchParams } from 'next/navigation';
import { PageTransitionIndicator } from './page-transition-indicator';
import { JoystickButton } from '../ui/joystick-button';
import { useLoading } from '@/contexts/loading-context';
import { SetupPinDialog } from '@/components/settings/pin-input-dialog';
import { GlobalLoadingIndicator } from './global-loading-indicator';
import { CredentialExpiryNotice } from '../auth/credential-expiry-notice';
import { OutOfCoinsOverlay } from '../dashboard/out-of-coins-overlay';
import AppLayoutClient from './app-layout-client';
import { WelcomeWorkflowModal } from '../dashboard/welcome-workflow-modal';
import { OnboardingModal } from '../dashboard/onboarding-modal';
import { useToast } from '@/hooks/use-toast';


export function ClientLayout({ children }: { children: ReactNode }) {
  const { 
    loading: authLoading, 
    user, 
    userProfile, 
    isPinEnabled, 
    isPinVerified, 
    verifyPin, 
    refreshContext,
    isPasswordChangeRequired,
    isPinChangeRequired
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const { setIsLoading } = useLoading();
  const { toast } = useToast();


  const [showInitialPinSetup, setShowInitialPinSetup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
 

  useEffect(() => {
       // Hide the static splash screen from layout.tsx once the app has mounted
       const staticSplash = document.getElementById('static-startup-splash');
       if (staticSplash) {
         staticSplash.style.opacity = '0';
         staticSplash.style.transition = 'opacity 0.5s ease-out';
         setTimeout(() => staticSplash.remove(), 500);
       }
   
       if ('serviceWorker' in navigator) {
         window.addEventListener('load', () => {
           navigator.serviceWorker.register('/sw.js').then(registration => {
             console.log('CONIV ServiceWorker registered');
           }).catch(err => {
             console.log('CONIV ServiceWorker failed', err);
           });
         });
       }
     }, []);
   
     useEffect(() => {
       const handleKeyDown = (event: KeyboardEvent) => {
         if (!pathname.startsWith('/dashboard') || !user || !event.altKey) {
           return;
         }
         
         event.preventDefault();
   
         let targetPath: string | null = null;
         const key = event.key.toLowerCase();
   
         switch (key) {
           case 'd': targetPath = '/dashboard'; break;
           case 'e': targetPath = '/dashboard/estimates/new'; break;
           case 'w': targetPath = '/dashboard/work-orders/new'; break;
           case 'i': targetPath = '/dashboard/invoices/new'; break;
           case 'c': targetPath = '/dashboard/companies/new'; break;
           case 'o': targetPath = '/dashboard/organizations/new'; break;
           case 'm': targetPath = '/dashboard/team'; break;
           case 'k': targetPath = '/dashboard/sor-rates'; break;
           case 'u': targetPath = '/dashboard/profile'; break;
           case 'a': targetPath = '/dashboard/advance-tools'; break;
           case 'x': targetPath = '/dashboard/expenses/new'; break;
           case 'n': targetPath = '/dashboard/inventory/new'; break;
           case 'l': targetPath = '/dashboard/labour-register'; break;
           case 's': targetPath = '/dashboard/settings'; break;
           case 'p': targetPath = '/dashboard/advance-tools/purchase-orders'; break;
           case 'f': targetPath = '/dashboard/follow-ups'; break;
           default: break;
         }
   
         if (targetPath && pathname !== targetPath) {
           setIsLoading(true);
           router.push(targetPath);
         }
       };
   
       window.addEventListener('keydown', handleKeyDown);
       return () => window.removeEventListener('keydown', handleKeyDown);
     }, [user, pathname, router, setIsLoading]);
   
   
     useEffect(() => {
       if (authLoading) return;
       
       if (user && !authLoading && 'Notification' in window && Notification.permission === 'default') {
         const timer = setTimeout(() => {
           Notification.requestPermission().then(permission => {
             if (permission === 'granted') {
               toast({ title: 'Notifications Enabled!' });
             }
           });
         }, 8000);
         return () => clearTimeout(timer);
        }
    
    const isNewUserSession = sessionStorage.getItem('isNewUser');
    if (isNewUserSession === 'true' && userProfile && !userProfile.isPinEnabled) {
        setShowOnboarding(true);
        sessionStorage.removeItem('isNewUser'); 
    }
    
    setIsLoading(false);

  }, [authLoading, user, userProfile, pathname, router, setIsLoading, toast]);



  const showPinScreen = user && userProfile && isPinEnabled && !isPinVerified && pathname.startsWith('/dashboard');
  const showOutOfCoinsOverlay = user && userProfile && !pathname.startsWith('/dashboard/coins-payments') && (userProfile.resourcePoints ?? 0) <= 0;

  if (authLoading) {
    return <StartupSplashScreen />;
  }
  
  const isDashboardRoute = pathname.startsWith('/dashboard');

  if (showPinScreen) {
    return (
      <>
        <PinVerificationScreen />
        <PageTransitionIndicator />
      </>
    );
  }

  if (isPasswordChangeRequired) {
    return (
        <>
            <CredentialExpiryNotice />
            {children}
            <PageTransitionIndicator />
        </>
    );
  }

  return (
    <>
      <GlobalLoadingIndicator />
      {isDashboardRoute && <WelcomeWorkflowModal />}
      {showOnboarding && <OnboardingModal isOpen={showOnboarding} onOpenChange={setShowOnboarding} />}
      {showOutOfCoinsOverlay && <OutOfCoinsOverlay />}
      {showInitialPinSetup && (
        <SetupPinDialog 
          isOpen={showInitialPinSetup}
          onOpenChange={setShowInitialPinSetup}
          onSetupComplete={() => {
            setShowInitialPinSetup(false);
            refreshContext(); 
          }}
        />
      )}
      {children}
      <PageTransitionIndicator />
      {user && userProfile && isDashboardRoute && <JoystickButton />}
    </>
  );
}
