
'use client';

import React, { Suspense } from 'react';
import DprListPage from '@/components/dpr/dpr-list-client';
import DprLoadingSkeleton from './loading';

export default function DprPage() {
    return (
        <Suspense fallback={<DprLoadingSkeleton />}>
            <DprListPage />
        </Suspense>
    );
}
