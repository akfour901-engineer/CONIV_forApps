
'use client';

import React, { Suspense } from 'react';
import LettersClientPage from '@/components/letter-generation/letters-client';
import LettersLoading from './loading';

export default function LettersPage() {
    return (
        <Suspense fallback={<LettersLoading />}>
            <LettersClientPage />
        </Suspense>
    );
}
