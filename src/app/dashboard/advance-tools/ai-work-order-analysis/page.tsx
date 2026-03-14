'use client';

import React, { Suspense } from 'react';
import AiWorkOrderAnalysisClientPage from '@/components/dashboard/advance-tools/ai-work-order-analysis/ai-work-order-analysis-client';
import AiWorkOrderAnalysisLoading from './loading';


export default function AiWorkOrderAnalysisPage() {
    return (
        <Suspense fallback={<AiWorkOrderAnalysisLoading />}>
            <AiWorkOrderAnalysisClientPage />
        </Suspense>
    );
}
