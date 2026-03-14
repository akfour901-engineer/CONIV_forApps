'use server';

import { Suspense } from 'react';
import ViewPurchaseOrderPageLoadingSkeleton from './loading';
import ViewPurchaseOrderPageContent from './view-purchase-order-client';

export default async function ViewPurchaseOrderPageWrapper({ params }: { params: { id: string } }) {
  // The 'id' is directly destructured from params as before, but the file is marked 'use server'
  // to ensure correct handling by Next.js.
  return (
    <Suspense fallback={<ViewPurchaseOrderPageLoadingSkeleton />}>
      <ViewPurchaseOrderPageContent poId={params.id}/>
    </Suspense>
  );
}
