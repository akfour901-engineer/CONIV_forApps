
'use client';

import React, { Suspense } from 'react';
import AiRiskAssessmentClientPage from '@/components/dashboard/advance-tools/ai-risk-assessment/ai-risk-assessment-client';
import AiRiskAssessmentLoading from './loading';

export default function AiRiskAssessmentPage() {
    return (
        <Suspense fallback={<AiRiskAssessmentLoading />}>
            <AiRiskAssessmentClientPage />
        </Suspense>
    );
}
