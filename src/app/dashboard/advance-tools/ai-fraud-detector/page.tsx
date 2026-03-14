'use client';

import React, { Suspense } from 'react';
import AiFraudDetectorClientPage from '@/components/dashboard/advance-tools/ai-fraud-detector/ai-fraud-detector-client';
import AiFraudDetectorLoading from './loading';

export default function AiFraudDetectorPage() {
    return (
        <Suspense fallback={<AiFraudDetectorLoading />}>
            <AiFraudDetectorClientPage />
        </Suspense>
    );
}
