
'use client';

import React, { Suspense } from 'react';
import MaterialsConsumptionClient from '@/components/dashboard/reports/materials-consumption/materials-consumption-client';
import MaterialsConsumptionLoading from '@/components/dashboard/reports/materials-consumption/loading';

export default function MaterialsConsumptionPage() {
    return (
        <Suspense fallback={<MaterialsConsumptionLoading />}>
            <MaterialsConsumptionClient />
        </Suspense>
    );
}
