
'use client';

import React, { Suspense } from 'react';
import AiExpenseAnomalyDetectionLoading from './loading';
import AiExpenseAnomalyDetectionClientPage from '@/components/dashboard/advance-tools/ai-expense-anomaly-detection/ai-expense-anomaly-detection-client';

export default function AiExpenseAnomalyDetectionPage() {
    return (
        <Suspense fallback={<AiExpenseAnomalyDetectionLoading />}>
            <AiExpenseAnomalyDetectionClientPage />
        </Suspense>
    );
}
