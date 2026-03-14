
'use client';

import React from 'react'
import { Suspense } from 'react'
import SorRatesClientPage from '@/components/sor/sor-rates-client';
import SorRatesLoading from './loading';

export default function SorRatesPage() {
  return (
    <Suspense fallback={<SorRatesLoading />}>
      <SorRatesClientPage />
    </Suspense>
  );
}

