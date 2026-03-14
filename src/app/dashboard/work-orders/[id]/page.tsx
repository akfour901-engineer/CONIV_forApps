
'use client';

import React, { Suspense } from 'react';
import ViewWorkOrderPageLoadingSkeleton from './loading';
import ViewWorkOrderPageContent from '@/components/dashboard/work-orders/view-work-order-client';

// This is now the dedicated page for VIEWING a work order.
export default function ViewWorkOrderPage({ params }: { params: { id: string }}) {
  const workOrderId = params.id;

  if (!workOrderId) {
    return <div>Invalid Work Order ID.</div>;
  }
  
  return (
    <Suspense fallback={<ViewWorkOrderPageLoadingSkeleton />}>
      <ViewWorkOrderPageContent id={workOrderId} />
    </Suspense>
  );
}
