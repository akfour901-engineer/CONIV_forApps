'use client';

import React, { Suspense } from 'react';
import DprSummaryClient from '@/components/dashboard/reports/dpr-summary/dpr-summary-client';
import DprSummaryLoading from '@/components/dashboard/reports/dpr-summary/loading';

export default function DprSummaryPage() {
    return (
        <Suspense fallback={<DprSummaryLoading />}>
            <DprSummaryClient />
        </Suspense>
    );
}
