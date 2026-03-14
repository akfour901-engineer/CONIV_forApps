
'use client';

import React, { Suspense } from 'react';
import FollowUpForm from '@/components/follow-ups/follow-up-form';
import NewFollowUpLoadingSkeleton from './loading';

export default function NewFollowUpPage() {
    return (
        <Suspense fallback={<NewFollowUpLoadingSkeleton />}>
            <FollowUpForm />
        </Suspense>
    );
}

    