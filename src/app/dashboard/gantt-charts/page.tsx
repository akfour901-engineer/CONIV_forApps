
'use client';

import React, { Suspense } from 'react';
import GanttChartClientPage from '@/components/gantt-charts/gantt-chart-client';
import GanttChartLoading from '@/components/gantt-charts/loading';

export default function GanttChartPage() {
    return (
        <Suspense fallback={<GanttChartLoading />}>
            <GanttChartClientPage />
        </Suspense>
    );
}
