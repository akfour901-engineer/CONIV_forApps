'use client';

import { Suspense } from 'react';
import NewInventoryItemLoading from './loading';
import NewInventoryItemPageContent from '@/components/inventory/new-inventory-item-client';

export default function NewInventoryItemPage() {
    return (
        <Suspense fallback={<NewInventoryItemLoading />}>
            <NewInventoryItemPageContent />
        </Suspense>
    )
}

