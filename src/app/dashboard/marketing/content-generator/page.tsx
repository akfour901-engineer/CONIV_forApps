
'use client';

import React, { Suspense } from 'react';
import AiContentGeneratorClientPage from '@/components/marketing/ai-content-generator-client';
import AiContentGeneratorLoading from './loading';

export default function AiContentGeneratorPage() {
    return (
        <Suspense fallback={<AiContentGeneratorLoading />}>
            <AiContentGeneratorClientPage />
        </Suspense>
    );
}
