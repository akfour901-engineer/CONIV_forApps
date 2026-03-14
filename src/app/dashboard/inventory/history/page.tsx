
'use client';

import React, { Suspense } from 'react';
import InventoryHistoryClientPage from '@/components/inventory/inventory-history-client';
import InventoryHistoryLoading from './loading';

export default function InventoryHistoryPage() {
    return (
        <Suspense fallback={<InventoryHistoryLoading />}>
            <InventoryHistoryClientPage />
        </Suspense>
    );
}

    