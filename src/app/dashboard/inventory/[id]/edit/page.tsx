'use client';

import React, { Suspense } from 'react';
import EditInventoryItemLoadingSkeleton from './loading';
import EditInventoryItemPageContent from '@/components/inventory/edit-inventory-item-client';

export default function EditInventoryItemPage({ params }: { params: { id: string } }) {
    const itemId = params.id;

    if (!itemId) {
        return <div>Invalid Inventory Item ID.</div>;
    }

    return (
        <Suspense fallback={<EditInventoryItemLoadingSkeleton />}>
            <EditInventoryItemPageContent itemId={itemId} />
        </Suspense>
    );
}

