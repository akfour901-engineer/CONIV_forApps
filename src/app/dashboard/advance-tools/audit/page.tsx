
'use client';

import React, { Suspense } from 'react';
import AuditClientPage from '@/components/dashboard/advance-tools/audit/audit-client';
import AuditLoadingSkeleton from './loading';

export default function AuditPage() {
    return (
        <Suspense fallback={<AuditLoadingSkeleton />}>
            <AuditClientPage />
        </Suspense>
    );
}
