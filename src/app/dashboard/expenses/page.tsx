
'use client';

import React, { Suspense } from 'react';
import ExpensesClientPage from '@/components/expenses/expenses-client';
import ExpensesLoadingSkeleton from './loading';

export default function ExpenseTrackingPage() {
    return (
        <Suspense fallback={<ExpensesLoadingSkeleton />}>
            <ExpensesClientPage />
        </Suspense>
    );
}
