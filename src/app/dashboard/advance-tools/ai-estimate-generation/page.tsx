
'use client';

import React, { Suspense } from 'react';
import AiEstimateGenerationClientPage from '@/components/dashboard/advance-tools/ai-estimate-generation/ai-estimate-generation-client';
import AiEstimateGenerationLoading from '@/components/dashboard/advance-tools/ai-estimate-generation/loading';

export default function AiEstimateGenerationPage() {
    return (
        <Suspense fallback={<AiEstimateGenerationLoading />}>
            <AiEstimateGenerationClientPage />
        </Suspense>
    );
}
