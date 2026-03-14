'use client';

import React, { Suspense } from 'react';
import { DprForm } from '@/components/dpr/dpr-form';
import DprDetailLoadingSkeleton from '@/app/dashboard/dpr/(form)/loading';


export default function NewDprPage() {
    return (
        <Suspense fallback={<DprDetailLoadingSkeleton />}>
            <DprForm />
        </Suspense>
    );
}
