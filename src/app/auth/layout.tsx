
'use client';

import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import type { ReactNode } from 'react';
import Logo from '@/components/logo';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLoading } from '@/contexts/loading-context';
import { GlobalLoadingIndicator } from '@/components/layout/global-loading-indicator';

// This component now assumes providers are in the root layout
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoading, setIsLoading } = useLoading();

  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams, setIsLoading]);

  return (
    <>
      <GlobalLoadingIndicator />
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 p-4">
        <div className="mb-8">
          <Logo
            href="/"
            textClassName="uppercase tracking-widest text-lg text-primary" 
            iconClassName="h-8 w-8"
          />
        </div>
        {children}
      </div>
    </>
  );
}
