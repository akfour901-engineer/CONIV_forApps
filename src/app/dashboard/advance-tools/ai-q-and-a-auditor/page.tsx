
'use client';

import React, { Suspense } from 'react';
import AiQAndAAuditorClientPage from '@/components/dashboard/advance-tools/ai-q-and-a-auditor/ai-q-and-a-auditor-client';
import AiQAndAAuditorLoading from '@/components/dashboard/advance-tools/ai-q-and-a-auditor/loading';

export default function AiQAndAAuditorPage() {
    return (
        <Suspense fallback={<AiQAndAAuditorLoading />}>
            <AiQAndAAuditorClientPage />
        </Suspense>
    );
}
