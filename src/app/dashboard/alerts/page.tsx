
'use client';

import React, { Suspense } from 'react';
import AllAlertsClientPage from '@/components/dashboard/alerts/alerts-client-page';
import AllAlertsLoadingSkeleton from '@/app/dashboard/alerts/loading';

export default function AllAlertsPage() {
    return (
        <Suspense fallback={<AllAlertsLoadingSkeleton />}>
            <AllAlertsClientPage />
        </Suspense>
    );
}
