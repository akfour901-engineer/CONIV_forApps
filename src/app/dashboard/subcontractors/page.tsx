
'use client';

import React from 'react'
import { Suspense } from 'react'
import SubcontractorsClientPage from '@/components/subcontractors/subcontractors-client';
import SubcontractorsLoading from './loading';

export default function SubcontractorsPage() {
    return (
        <Suspense fallback={<SubcontractorsLoading />}>
            <SubcontractorsClientPage />
        </Suspense>
    );
}
