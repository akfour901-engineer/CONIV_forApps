
'use client';

import React, { Suspense } from 'react';
import BuySellExchangeClientPage from '@/components/dashboard/advance-tools/buy-sell-exchange/buy-sell-exchange-client';
import BuySellExchangeLoading from '@/app/dashboard/advance-tools/buy-sell-exchange/loading';

export default function BuySellExchangePage() {
    return (
        <Suspense fallback={<BuySellExchangeLoading />}>
            <BuySellExchangeClientPage />
        </Suspense>
    );
}
