'use client';

import React, { Suspense } from 'react';
import AiCashFlowForecasterClientPage from '@/components/dashboard/advance-tools/ai-cash-flow-forecaster/ai-cash-flow-forecaster-client';
import AiCashFlowForecasterLoading from './loading';

export default function AiCashFlowForecasterPage() {
    return (
        <Suspense fallback={<AiCashFlowForecasterLoading />}>
            <AiCashFlowForecasterClientPage />
        </Suspense>
    );
}
