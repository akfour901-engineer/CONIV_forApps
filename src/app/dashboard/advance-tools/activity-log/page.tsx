
'use client';

import React, { Suspense } from 'react';
import ActivityLogClientPage from '@/components/dashboard/advance-tools/activity-log/activity-log-client';
import ActivityLogLoadingSkeleton from '@/app/dashboard/advance-tools/activity-log/loading';

export default function ActivityLogPage() {
    return (
        <Suspense fallback={<ActivityLogLoadingSkeleton />}>
            <ActivityLogClientPage />
        </Suspense>
    );
}
