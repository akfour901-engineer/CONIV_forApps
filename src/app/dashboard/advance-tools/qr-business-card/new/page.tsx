
'use client';

import React, { Suspense } from 'react';
import NewDigitalBusinessCardLoadingSkeleton from './loading';
import NewDigitalBusinessCardPageContent from '@/components/dashboard/advance-tools/qr-business-card/new/new-card-client';

export default function NewDigitalBusinessCardPage() {
    return (
        <Suspense fallback={<NewDigitalBusinessCardLoadingSkeleton />}>
            <NewDigitalBusinessCardPageContent />
        </Suspense>
    );
}
