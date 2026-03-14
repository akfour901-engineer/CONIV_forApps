
'use client';

import React, { Suspense } from 'react';
import CompaniesClientPage from '@/components/companies/companies-client';
import CompaniesLoading from './loading';

export default function CompaniesPage() {
    return (
        <Suspense fallback={<CompaniesLoading />}>
            <CompaniesClientPage />
        </Suspense>
    );
}
