
'use client';

import React, { Suspense } from 'react';
import AdvanceToolsLoadingSkeleton from './loading';
import AdvanceToolsClientPage from '@/components/dashboard/advance-tools/advance-tools-client';

export default function AdvanceToolsPage() {
    return (
        <Suspense fallback={<AdvanceToolsLoadingSkeleton />}>
            <AdvanceToolsClientPage />
        </Suspense>
    );
}
