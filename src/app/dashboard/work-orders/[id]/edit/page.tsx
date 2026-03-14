
'use client';

import React, { Suspense } from 'react';
import EditWorkOrderPageSkeleton from './loading';
import EditWorkOrderPageContent from './edit-work-order-client';

export default function EditWorkOrderPage({ params }: { params: { id: string } }) {
  const workOrderId = params.id;

  if (!workOrderId) {
    return <div>Invalid Work Order ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditWorkOrderPageSkeleton />}>
      <EditWorkOrderPageContent id={workOrderId} />
    </Suspense>
  );
}
