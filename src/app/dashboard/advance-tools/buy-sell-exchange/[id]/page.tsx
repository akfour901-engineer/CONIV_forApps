
'use client';

import React, { Suspense } from 'react';
import EditListingLoadingSkeleton from './edit/loading'; // Re-using loading skeleton
import ViewListingClientPage from '@/components/dashboard/advance-tools/buy-sell-exchange/[id]/view-listing-client';

export default function ViewListingPage({ params }: { params: { id: string } }) {
  const listingId = params.id;

  if (!listingId) {
    return <div>Invalid Listing ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditListingLoadingSkeleton />}>
      <ViewListingClientPage listingId={listingId} />
    </Suspense>
  );
}
