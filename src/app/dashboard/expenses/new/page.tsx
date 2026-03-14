'use client';

import React, { Suspense } from 'react';
import NewExpensePageSkeleton from './loading';
import NewExpensePageContent from '@/components/expenses/new-expense-client';

export default function NewExpensePageWrapper() {
  return (
    <Suspense fallback={<NewExpensePageSkeleton />}>
      <NewExpensePageContent />
    </Suspense>
  );
}
