
'use client';

import React, { Suspense } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppLayout from './app-layout';
import { AppHeader } from './app-header';
import DashboardLoadingSkeleton from '@/app/dashboard/loading';
import { useAuth } from '@/hooks/use-auth';
import { WelcomeWorkflowModal } from '../dashboard/welcome-workflow-modal';

export default function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();
  
  // Conditionally render layout based on route
  // For landing page and auth pages, we don't need the full dashboard layout
  const noAppLayoutRoutes = ['/', '/auth/signin', '/auth/signup', '/auth/forgot-password', '/auth/reset-password'];
  const isPublicView = pathname.startsWith('/view/') || pathname.startsWith('/p/');
  
  if (noAppLayoutRoutes.includes(pathname) || isPublicView) {
    return <main>{children}</main>;
  }

  // All other routes get the full dashboard layout
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        <AppLayout>
          <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 flex-1 overflow-hidden">
            <AppHeader />
            <Suspense fallback={<DashboardLoadingSkeleton />}>
              <main className="flex-1 overflow-auto p-4 sm:p-6 animate-fade-in pb-20 md:pb-6">
                  {children}
              </main>
            </Suspense>
          </div>
        </AppLayout>
      </div>
    </SidebarProvider>
  );
}
