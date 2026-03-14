
'use client';

import React from 'react';
import { ConivAppIcon } from '@/components/layout/logo';
import { cn } from '@/lib/utils';

export default function DashboardLoadingSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-4 fade-in">
      <div className="flex flex-col items-center justify-center">
        <ConivAppIcon className="w-24 h-24 text-primary animate-rocket-rumble" />
        <p className="mt-4 animate-pulse text-sm font-medium text-muted-foreground">
          Loading Dashboard...
        </p>
      </div>
    </div>
  );
}
