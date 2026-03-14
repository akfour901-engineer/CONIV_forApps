'use client';

import React, { Suspense } from 'react';
import WorkOrderProfitabilityClient from '@/components/dashboard/reports/work-order-profitability-client';
import WorkOrderProfitabilityLoading from '@/components/dashboard/reports/work-order-profitability-loading';


export default function WorkOrderProfitabilityPage() {
    return (
        <Suspense fallback={<WorkOrderProfitabilityLoading />}>
            <WorkOrderProfitabilityClient />
        </Suspense>
    );
}
