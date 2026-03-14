'use client';

import React, { Suspense } from 'react';
import FinancialSummaryClientPage from '@/components/reports/financial-summary/financial-summary-client';
import FinancialSummaryLoadingSkeleton from './loading';

export default function FinancialSummaryPage() {
    return (
        <Suspense fallback={<FinancialSummaryLoadingSkeleton />}>
            <FinancialSummaryClientPage />
        </Suspense>
    );
}
