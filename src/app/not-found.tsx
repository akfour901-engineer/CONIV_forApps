'use client';

import { ArrowLeft, Frown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLoading } from '@/contexts/loading-context';
import { useEffect, useState } from 'react';

/**
 * Custom 404 Page.
 * Note: This is a client component. Do not use 'export const dynamic' here
 * as it is reserved for Server Components and can cause build artifacts to fail.
 */
export default function NotFound() {
  const { setIsLoading } = useLoading();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <Frown className="h-20 w-20 text-primary" />
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        404 - Page Not Found
      </h1>
      <p className="mt-4 text-base text-muted-foreground">
        Sorry, we couldn’t find the page you’re looking for.
      </p>
      <div className="mt-10">
        <Button asChild onClick={() => setIsLoading(true)}>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
