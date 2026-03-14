'use client';

import React, { Suspense } from 'react';
import InvoicesClientPage from '@/components/invoices/invoices-client';
import InvoicesLoading from './loading';

export default function InvoicesPage() {
    return (
        <Suspense fallback={<InvoicesLoading />}>
            <InvoicesClientPage />
        </Suspense>
    );
}