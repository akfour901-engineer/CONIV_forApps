'use client';

import { Button } from '@/components/ui/button';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <WifiOff className="h-20 w-20 text-muted-foreground" />
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        You are Offline
      </h1>
      <p className="mt-4 text-base text-muted-foreground">
        It seems you`ve lost your internet connection. Please check your network and try again.
      </p>
      <div className="mt-10">
        <Button onClick={handleReload}>
          Retry Connection
        </Button>
      </div>
    </div>
  );
}
