
'use client';

import React, { Suspense } from 'react';
import MailingListClientPage from '@/components/marketing/mailing-list-client';
import MailingListLoading from './loading';

export default function MailingListPage() {
    return (
        <Suspense fallback={<MailingListLoading />}>
            <MailingListClientPage />
        </Suspense>
    );
}
