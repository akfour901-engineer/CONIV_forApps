
'use client';

import React, { Suspense } from 'react';
import AiSafetyComplianceClientPage from '@/components/dashboard/advance-tools/ai-safety-compliance/ai-safety-compliance-client';
import AiSafetyComplianceLoading from '@/components/dashboard/advance-tools/ai-safety-compliance/loading';

export default function AiSafetyCompliancePage() {
    return (
        <Suspense fallback={<AiSafetyComplianceLoading />}>
            <AiSafetyComplianceClientPage />
        </Suspense>
    );
}
