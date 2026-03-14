
'use client';

import React, { Suspense } from 'react';
import EditExpensePageSkeleton from './loading';
import EditExpensePageContent from '@/components/expenses/edit-expense-client';

export const dynamic = 'force-dynamic';

export default function EditExpensePage({ params }: { params: { id: string } }) {
  const expenseId = params.id;

  if (!expenseId) {
    return <div>Invalid Expense ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditExpensePageSkeleton />}>
      <EditExpensePageContent expenseId={expenseId} />
    </Suspense>
  );
}
