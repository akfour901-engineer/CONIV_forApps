
'use client';

import React, { Suspense } from 'react';
import NewLicenseClient from '@/components/licenses/new-license-client';
import NewLicenseLoadingSkeleton from './loading';

export default function NewLicensePage() {
    return (
        <Suspense fallback={<NewLicenseLoadingSkeleton />}>
            <NewLicenseClient />
        </Suspense>
    );
}
