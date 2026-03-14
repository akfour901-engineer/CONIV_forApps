'use client';

import React, { Suspense } from 'react';
import EditSubcontractorLoadingSkeleton from './loading';
import EditSubcontractorPageContent from '@/components/subcontractors/edit-subcontractor-client';

export default function EditSubcontractorPage({ params }: { params: { id: string } }) {
  const subcontractorId = params.id;

  if (!subcontractorId) {
    return <div>Invalid Subcontractor ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditSubcontractorLoadingSkeleton />}>
      <EditSubcontractorPageContent subcontractorId={subcontractorId} />
    </Suspense>
  );
}