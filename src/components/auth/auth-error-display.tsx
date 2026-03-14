'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLoading } from '@/contexts/loading-context';

interface AuthErrorDisplayProps {
  errorType: 'network' | 'permission' | 'unknown';
}

export function AuthErrorDisplay({ errorType }: AuthErrorDisplayProps) {
    const { setIsLoading } = useLoading();

  const errorDetails = {
    network: {
      title: "Network Connection Error",
      message: "We couldn't connect to our services. Please check your internet connection and try again.",
    },
    permission: {
      title: "Permission Denied",
      message: "You do not have the required permissions to access this resource. Please contact your account administrator.",
    },
    unknown: {
      title: "An Unexpected Error Occurred",
      message: "Something went wrong on our end. Please try again in a few moments.",
    }
  };

  const details = errorDetails[errorType] || errorDetails.unknown;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <AlertCircle className="h-16 w-16 text-destructive" />
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {details.title}
      </h1>
      <p className="mt-4 text-base text-muted-foreground">
        {details.message}
      </p>
      <div className="mt-10">
        <Button asChild onClick={() => setIsLoading(true)}>
            <Link href="/dashboard">
                Try Again
            </Link>
        </Button>
      </div>
    </div>
  );
}
