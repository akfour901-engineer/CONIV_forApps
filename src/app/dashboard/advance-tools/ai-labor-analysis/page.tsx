'use client';

import React, { Suspense } from 'react';
import AiLaborAnalysisClientPage from '@/components/dashboard/advance-tools/ai-labor-analysis/ai-labor-analysis-client';
import AiLaborAnalysisLoading from './loading';

export default function AiLaborAnalysisPage() {
    return (
        <Suspense fallback={<AiLaborAnalysisLoading />}>
            <AiLaborAnalysisClientPage />
        </Suspense>
    );
}
