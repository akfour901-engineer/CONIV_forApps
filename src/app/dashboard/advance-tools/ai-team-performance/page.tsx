'use client';

import React, { Suspense } from 'react';
import AiTeamPerformanceClientPage from '@/components/dashboard/advance-tools/ai-team-performance/ai-team-performance-client';
import AiTeamPerformanceLoading from './loading';

export default function AiTeamPerformancePage() {
    return (
        <Suspense fallback={<AiTeamPerformanceLoading />}>
            <AiTeamPerformanceClientPage />
        </Suspense>
    );
}
