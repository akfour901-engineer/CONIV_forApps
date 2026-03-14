
'use client';

import React, { Suspense } from 'react';
import TimeTrackingClientPage from '@/components/dashboard/advance-tools/time-tracking/time-tracking-client';
import TimeTrackingLoading from '@/components/dashboard/advance-tools/time-tracking/loading';

export default function TimeTrackingPage() {
    return (
        <Suspense fallback={<TimeTrackingLoading />}>
            <TimeTrackingClientPage />
        </Suspense>
    );
}
