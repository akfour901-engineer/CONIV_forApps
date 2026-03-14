

'use client';

import React, { Suspense } from 'react';
import EditPurchaseOrderPageSkeleton from './loading';
import EditPurchaseOrderClient from './edit-purchase-order-client';
import { useParams } from 'next/navigation';

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const poId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  if (!poId) {
    return <div>Invalid Purchase Order ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditPurchaseOrderPageSkeleton />}>
      <EditPurchaseOrderClient poId={poId} />
    </Suspense>
  );
}
