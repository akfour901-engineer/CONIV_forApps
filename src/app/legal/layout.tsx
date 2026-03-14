
'use client';

import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import type { ReactNode } from 'react';
import Logo from '@/components/logo';
import { useLoading } from '@/contexts/loading-context';
import { GlobalLoadingIndicator } from '@/components/layout/global-loading-indicator';

function PublicLayoutContent({ children }: { children: ReactNode }) {
  const { setIsLoading } = useLoading();
  return (
    <>
      <GlobalLoadingIndicator />
      <header className="sticky top-0 z-40 px-4 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur-sm">
        <Logo href="/" textClassName="text-lg text-foreground" iconClassName="h-6 w-6" onNavigate={() => setIsLoading(true)} />
      </header>
      <main className="flex-1">
        {children}
      </main>
    </>
  );
}

export default function PublicLegalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicLayoutContent>{children}</PublicLayoutContent>;
}
