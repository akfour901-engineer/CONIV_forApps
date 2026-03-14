
'use client';

import React, { Suspense } from 'react';
import MailingListClientPage from '@/components/marketing/mailing-list-client';
import MailingListLoading from '@/app/dashboard/marketing/mailing-list/loading';

export default function MailingListsPage() {
    return (
        <Suspense fallback={<MailingListLoading />}>
            <MailingListClientPage />
        </Suspense>
    );
}
