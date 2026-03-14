
'use client';

import React, { Suspense } from 'react';
import AiSmartCollectionsClientPage from '@/components/dashboard/advance-tools/ai-smart-collections/ai-smart-collections-client';
import AiSmartCollectionsLoading from '@/components/dashboard/advance-tools/ai-smart-collections/loading';

export default function AiSmartCollectionsPage() {
    return (
        <Suspense fallback={<AiSmartCollectionsLoading />}>
            <AiSmartCollectionsClientPage />
        </Suspense>
    );
}
