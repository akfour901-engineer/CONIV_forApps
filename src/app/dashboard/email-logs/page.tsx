
'use client';

import React, { Suspense } from 'react';
import EmailLogsClientPage from '@/components/dashboard/email-logs/email-logs-client';
import EmailLogsLoadingSkeleton from './loading';

export default function EmailLogsPage() {
    return (
        <Suspense fallback={<EmailLogsLoadingSkeleton />}>
            <EmailLogsClientPage />
        </Suspense>
    );
}

    