'use client';

import React, { Suspense } from 'react';
import EditSorRateLoadingSkeleton from './loading';
import EditSorRatePageContent from '@/components/sor/edit-sor-rate-client';

export default function EditSorRatePage({ params }: { params: { id: string } }) {
  const sorRateId = params.id;
  if (!sorRateId) {
    return <div>Invalid SOR Rate ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditSorRateLoadingSkeleton />}>
      <EditSorRatePageContent sorRateId={sorRateId} />
    </Suspense>
  );
}
