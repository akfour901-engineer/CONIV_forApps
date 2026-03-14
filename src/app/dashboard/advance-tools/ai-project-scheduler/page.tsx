
'use client';

import React, { Suspense } from 'react';
import GanttChartLoading from '@/components/gantt-charts/loading';
import AiProjectSchedulerClientPage from '@/components/dashboard/advance-tools/ai-project-scheduler/ai-project-scheduler-client';

export default function AiProjectSchedulerPage() {
    return (
        <Suspense fallback={<GanttChartLoading />}>
            <AiProjectSchedulerClientPage />
        </Suspense>
    );
}
