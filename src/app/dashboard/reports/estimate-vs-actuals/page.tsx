
'use client';

import React, { Suspense } from 'react';
import EstimateVsActualsClient from '@/components/dashboard/reports/estimate-vs-actuals-client';
import EstimateVsActualsLoading from '@/components/dashboard/reports/estimate-vs-actuals-loading';

export default function EstimateVsActualsPage() {
    return (
        <Suspense fallback={<EstimateVsActualsLoading />}>
            <EstimateVsActualsClient />
        </Suspense>
    );
}
