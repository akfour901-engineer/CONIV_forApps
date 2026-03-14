
'use client';

import React from 'react';
import Logo from '@/components/layout/logo';

export default function DashboardLoadingSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-4 fade-in">
      <div className="flex flex-col items-center justify-center">
        <Logo
          href="#"
          iconClassName="h-48 w-48 text-primary animate-logo-vibrate"
          iconOnly={true}
        />
        <p className="mt-4 animate-pulse text-sm font-medium text-muted-foreground">
          Loading Dashboard...
        </p>
      </div>
    </div>
  );
}
