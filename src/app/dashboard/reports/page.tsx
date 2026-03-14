
'use client';

import React, { Suspense } from 'react';
import FinancialSummaryLoadingSkeleton from '@/app/dashboard/financial-summary/loading';
import AdvancedReportingClientPage from '@/components/reports/advanced-reporting-client';


export default function ReportsPage() {
    return (
        <Suspense fallback={<FinancialSummaryLoadingSkeleton />}>
            <AdvancedReportingClientPage />
        </Suspense>
    );
}
