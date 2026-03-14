
'use client';

import React, { Suspense } from 'react';
import AiDocumentAnalysisClientPage from '@/components/dashboard/advance-tools/ai-document-analysis/ai-document-analysis-client';
import AiDocumentAnalysisLoading from './loading';

export default function AiDocumentAnalysisPage() {
    return (
        <Suspense fallback={<AiDocumentAnalysisLoading />}>
            <AiDocumentAnalysisClientPage />
        </Suspense>
    );
}
