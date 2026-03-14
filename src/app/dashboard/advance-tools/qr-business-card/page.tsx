
'use client';

import React, { Suspense } from 'react';
import QrBusinessCardListPage from '@/components/dashboard/advance-tools/qr-business-card/qr-business-card-client';
import QrBusinessCardListLoading from './loading';


export default function QrBusinessCardsPage() {
    return (
        <Suspense fallback={<QrBusinessCardListLoading />}>
            <QrBusinessCardListPage />
        </Suspense>
    );
}
