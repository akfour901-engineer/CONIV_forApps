
      'use client';

import React, { Suspense } from 'react';
import NewWorkOrderPageSkeleton from './loading';
import NewWorkOrderPageContent from '@/components/work-orders/new-work-order-client';

export default function NewWorkOrderPageWrapper() {
  return (
    <Suspense fallback={<NewWorkOrderPageSkeleton />}>
      <NewWorkOrderPageContent />
    </Suspense>
  );
}

    