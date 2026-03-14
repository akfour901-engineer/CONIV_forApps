
'use client';

import React, { Suspense } from 'react';
import AiBidAdvisorClientPage from '@/components/dashboard/advance-tools/ai-bid-advisor/ai-bid-advisor-client';
import AiBidAdvisorLoading from '@/components/dashboard/advance-tools/ai-bid-advisor/loading';

export default function AiBidAdvisorPage() {
    return (
        <Suspense fallback={<AiBidAdvisorLoading />}>
            <AiBidAdvisorClientPage />
        </Suspense>
    );
}
