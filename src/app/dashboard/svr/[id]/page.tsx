
      
'use client';

import React, { Suspense } from 'react';
import ViewSvrLoadingSkeleton from './loading';
import ViewSvrContent from './view-svr-client';
import { SvrForm } from '@/components/svr/svr-form';
import { useSearchParams } from 'next/navigation';

export default function SvrPage({ params }: { params: { id: string }}) {
  const searchParams = useSearchParams();
  const svrId = params.id;
  const isEditing = searchParams?.get('edit') === 'true';

  if (!svrId) {
    return <div>Invalid Service Visit Report ID.</div>;
  }
  
  if (isEditing) {
    // Re-using the main loading skeleton for the edit view as well.
    return (
      <Suspense fallback={<ViewSvrLoadingSkeleton />}>
        <SvrForm svrId={svrId} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ViewSvrLoadingSkeleton />}>
      <ViewSvrContent svrId={svrId} />
    </Suspense>
  );
}

    