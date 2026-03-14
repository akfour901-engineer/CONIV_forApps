
'use client';

import React, { Suspense } from 'react';
import LicensesClientPage from '@/components/licenses/licenses-client';
import LicensesLoading from './loading';

export default function LicensesPage() {
    return (
        <Suspense fallback={<LicensesLoading />}>
            <LicensesClientPage />
        </Suspense>
    );
}

