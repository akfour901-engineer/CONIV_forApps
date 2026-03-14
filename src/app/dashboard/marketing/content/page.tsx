
'use client';

import React, { Suspense } from 'react';
import MarketingContentClientPage from '@/components/marketing/content-client';
import MailingListLoading from '@/app/dashboard/marketing/mailing-list/loading';

export default function MarketingContentPage() {
    return (
        <Suspense fallback={<MailingListLoading />}>
            <MarketingContentClientPage />
        </Suspense>
    );
}
