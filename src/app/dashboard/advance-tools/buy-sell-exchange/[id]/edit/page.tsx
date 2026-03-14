
'use client';

import React, { Suspense } from 'react';
import EditListingLoadingSkeleton from './loading';
import EditListingClientPage from '@/components/dashboard/advance-tools/buy-sell-exchange/[id]/edit/edit-listing-client';

export default function EditListingPage({ params }: { params: { id: string } }) {
  const listingId = params.id;

  if (!listingId) {
    return <div>Invalid Listing ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditListingLoadingSkeleton />}>
      <EditListingClientPage listingId={listingId} />
    </Suspense>
  );
}
