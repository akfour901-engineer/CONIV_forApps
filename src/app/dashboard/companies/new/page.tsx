
'use client';

import React, { Suspense } from 'react';
import NewCompanyLoadingSkeleton from './loading';
import NewCompanyPageContent from '@/components/companies/new-company-client';

export default function NewCompanyPageWrapper() {
  return (
    <Suspense fallback={<NewCompanyLoadingSkeleton />}>
      <NewCompanyPageContent />
    </Suspense>
  );
}
