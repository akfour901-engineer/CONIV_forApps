
'use client';

import React, { Suspense } from 'react';
import EstimatesClientPage from '@/components/estimates/estimates-client';
import EstimatesLoading from './loading';

export default function EstimatesPage() {
    return (
        <Suspense fallback={<EstimatesLoading />}>
            <EstimatesClientPage />
        </Suspense>
    );
}
