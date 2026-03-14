
'use client';

import React, { Suspense } from 'react';
import InventoryClientPage from '@/components/inventory/inventory-client';
import InventoryLoadingSkeleton from './loading';

export default function InventoryPage() {
    return (
        <Suspense fallback={<InventoryLoadingSkeleton />}>
            <InventoryClientPage />
        </Suspense>
    );
}

