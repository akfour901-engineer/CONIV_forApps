
'use client';

import React, { Suspense } from 'react';
import NewDigitalBusinessCardLoadingSkeleton from '@/app/dashboard/advance-tools/qr-business-card/new/loading';
import NewListingPageContent from './new-card-client';

export default function NewListingPage() {
    return (
        <Suspense fallback={<NewDigitalBusinessCardLoadingSkeleton />}>
            <NewListingPageContent />
        </Suspense>
    );
}
