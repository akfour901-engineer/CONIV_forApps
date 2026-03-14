'use client';

import React, { Suspense } from 'react';
import FinancialSummaryClientPage from '@/components/dashboard/reports/financial-summary-client';
import FinancialSummaryLoadingSkeleton from '@/app/dashboard/financial-summary/loading';

export default function FinancialSummaryPage() {
    return (
        <Suspense fallback={<FinancialSummaryLoadingSkeleton />}>
            <FinancialSummaryClientPage />
        </Suspense>
    );
}
