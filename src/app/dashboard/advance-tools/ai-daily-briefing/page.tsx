
'use client';

import React, { Suspense } from 'react';
import AiDailyBriefingClientPage from '@/components/dashboard/advance-tools/ai-daily-briefing/ai-daily-briefing-client';
import AiDailyBriefingLoading from '@/components/dashboard/advance-tools/ai-daily-briefing/loading';

export default function AiDailyBriefingPage() {
    return (
        <Suspense fallback={<AiDailyBriefingLoading />}>
            <AiDailyBriefingClientPage />
        </Suspense>
    );
}
