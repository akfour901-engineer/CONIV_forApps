
'use client';

import React, { Suspense } from 'react';
import EmailLogsClient from '@/components/admin/email-logs-client';
import EmailLogsLoading from './loading';

export default function EmailLogsPage() {
    return (
        <Suspense fallback={<EmailLogsLoading />}>
            <EmailLogsClient />
        </Suspense>
    );
}
