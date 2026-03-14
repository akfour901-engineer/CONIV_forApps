'use client';

import { useLoading } from "@/contexts/loading-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Logo from '@/components/logo';
import { useEffect, useState } from 'react';

export function LandingPageHeader() {
  const { setIsLoading } = useLoading();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <header className="sticky top-0 z-40 px-4 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur-sm">
        <Logo href="/" textClassName="text-lg text-foreground" iconClassName="h-6 w-6" />
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 px-4 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur-sm">
      <Logo href="/" textClassName="text-lg text-foreground" iconClassName="h-6 w-6" />
      <nav className="ml-auto flex gap-4 sm:gap-6">
        <Link href="/auth/signin" prefetch={false} onClick={() => setIsLoading(true)}>
          <Button>
            Sign In
          </Button>
        </Link>
      </nav>
    </header>
  );
}