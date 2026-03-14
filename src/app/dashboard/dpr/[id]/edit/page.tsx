'use client';

import React, { Suspense } from 'react';
import { DprForm } from '@/components/dpr/dpr-form';
import DprDetailLoadingSkeleton from '@/app/dashboard/dpr/(form)/loading';


// This page now handles both viewing and editing.
// Note: Direct access to searchParams is a feature of Server Components.
export default function DprPage({ params }: { params: { id: string }}) {
  
  return (
     <Suspense fallback={<DprDetailLoadingSkeleton />}>
        <DprForm dprId={params.id === 'new' ? undefined : params.id} />
    </Suspense>
  );
}
