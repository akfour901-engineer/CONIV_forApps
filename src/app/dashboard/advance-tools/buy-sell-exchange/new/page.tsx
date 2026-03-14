
'use client';

import React, { Suspense } from 'react';
import NewListingPageSkeleton from './loading';
import NewListingPageContent from '@/components/dashboard/advance-tools/buy-sell-exchange/new/new-listing-client';

export default function NewListingPage() {
    return (
        <Suspense fallback={<NewListingPageSkeleton />}>
            <NewListingPageContent />
        </Suspense>
    );
}
