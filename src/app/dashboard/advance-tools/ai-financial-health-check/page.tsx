
'use client';

import React, { Suspense } from 'react';
import AiFinancialHealthCheckClientPage from '@/components/dashboard/advance-tools/ai-financial-health-check/ai-financial-health-check-client';
import AiFinancialHealthCheckLoading from '@/components/dashboard/advance-tools/ai-financial-health-check/loading';

export default function AiFinancialHealthCheckPage() {
    return (
        <Suspense fallback={<AiFinancialHealthCheckLoading />}>
            <AiFinancialHealthCheckClientPage />
        </Suspense>
    );
}

