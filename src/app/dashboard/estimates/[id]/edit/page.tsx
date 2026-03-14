
'use client';

import React, { Suspense } from 'react';
import EditEstimatePageSkeleton from '@/app/dashboard/estimates/[id]/edit/loading';
import { EditEstimatePageContent } from '@/components/estimates/edit-estimate-client';
import { useParams } from 'next/navigation';

export default function EditEstimatePageWrapper() {
  const params = useParams();
  const estimateId = typeof params?.id === 'string' ? params.id : '';

  if (!estimateId) {
    return <div>Invalid estimate ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditEstimatePageSkeleton />}>
      <EditEstimatePageContent estimateId={estimateId} />
    </Suspense>
  );
}

    