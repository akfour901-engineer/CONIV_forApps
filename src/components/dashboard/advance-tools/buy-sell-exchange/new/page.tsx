
'use client';

import React, { Suspense } from 'react';
import NewListingLoadingSkeleton from './loading';
import NewListingClientPage from '@/components/dashboard/advance-tools/buy-sell-exchange/new/new-listing-client';

export default function NewListingPage() {
    return (
        <Suspense fallback={<NewListingLoadingSkeleton />}>
            <NewListingClientPage />
        </Suspense>
    );
}
