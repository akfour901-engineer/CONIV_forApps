
'use client';

import React, { Suspense } from 'react';
import BuyCoinsLoadingSkeleton from './loading';
import { BuyCoinsClientPage } from '@/components/coins-payments/buy-coins-client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLoading } from '@/contexts/loading-context';

export default function BuyCoinsPageWrapper() {
  const { setIsLoading } = useLoading();

  return (
    <Suspense fallback={<BuyCoinsLoadingSkeleton />}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Buy Resource Points
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Purchase more resource points to continue using premium features.
            </p>
          </div>
          <Button variant="outline" asChild onClick={() => setIsLoading(true)}>
            <Link href="/dashboard/coins-payments">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Coins & Payments
            </Link>
          </Button>
        </div>
        <BuyCoinsClientPage />
      </div>
    </Suspense>
  );
}
