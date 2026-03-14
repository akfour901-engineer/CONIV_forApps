
'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { LoadingProvider } from '@/contexts/loading-context';
import { ThemeProvider } from 'next-themes';
import React, { ReactNode, useEffect } from 'react';
import { PwaInstallProvider } from '@/contexts/pwa-install-context';
import { FirebaseProvider } from '@/firebase/provider';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, function(err) {
          console.log('ServiceWorker registration failed: ', err);
        });
      });
    }
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LoadingProvider>
        <PwaInstallProvider>
          <FirebaseProvider>
            <AuthProvider>
                {children}
            </AuthProvider>
          </FirebaseProvider>
        </PwaInstallProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
}
