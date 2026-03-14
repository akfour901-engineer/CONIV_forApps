'use client';

import React from 'react'
import Suspense from 'react'
import NewSubcontractorPageSkeleton from './loading';
import NewSubcontractorPageContent from '@/components/subcontractors/new-subcontractor-client';

export default function NewSubcontractorPageWrapper() {
  return (
    <React.Suspense fallback={<NewSubcontractorPageSkeleton />}>
      <NewSubcontractorPageContent />
    </React.Suspense>
  );
}
