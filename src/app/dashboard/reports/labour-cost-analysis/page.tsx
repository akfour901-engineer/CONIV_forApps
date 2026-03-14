'use client';

import React, { Suspense } from 'react';
import LabourCostAnalysisClient from '@/components/dashboard/reports/labour-cost-analysis-client';
import LabourCostAnalysisLoading from '@/components/dashboard/reports/labour-cost-analysis-loading';

export default function LabourCostAnalysisPage() {
    return (
        <Suspense fallback={<LabourCostAnalysisLoading />}>
            <LabourCostAnalysisClient />
        </Suspense>
    );
}
