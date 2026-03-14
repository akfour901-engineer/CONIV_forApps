
'use client';

import React, { Suspense } from 'react';
import NewInvoicePageSkeleton from './loading';
import NewInvoicePageContent from '@/components/invoices/new-invoice-client';

function NewInvoicePageWrapper() {
    return (
        <Suspense fallback={<NewInvoicePageSkeleton />}>
            <NewInvoicePageContent />
        </Suspense>
    )
}
export default NewInvoicePageWrapper;
