
'use client';

import React, { Suspense } from 'react';
import AiMaterialsForecasterLoading from './loading';
import AiMaterialsForecasterClientPage from '@/components/dashboard/advance-tools/ai-materials-forecaster/ai-materials-forecaster-client';

export default function AiMaterialsForecasterPage() {
    return (
        <Suspense fallback={<AiMaterialsForecasterLoading />}>
            <AiMaterialsForecasterClientPage />
        </Suspense>
    );
}
