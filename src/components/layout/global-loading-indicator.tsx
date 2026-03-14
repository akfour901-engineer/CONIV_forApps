
'use client';

import { useLoading } from '@/contexts/loading-context';
import Logo from './logo';

// This component is the primary full-screen loading indicator for the application.
export function GlobalLoadingIndicator() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center">
        <Logo
          href="#"
          iconClassName="h-48 w-48 text-primary animate-logo-vibrate"
          iconOnly={true}
        />
        <p className="mt-4 animate-pulse text-sm font-medium text-muted-foreground">
          Processing...
        </p>
      </div>
    </div>
  );
}
