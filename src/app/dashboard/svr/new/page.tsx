
      
'use client';

import React, { Suspense } from 'react';
import { SvrForm } from '@/components/svr/svr-form';
import NewSvrLoadingSkeleton from './loading';

export default function NewSvrPage() {
    return (
        <Suspense fallback={<NewSvrLoadingSkeleton />}>
            <SvrForm />
        </Suspense>
    );
}

    