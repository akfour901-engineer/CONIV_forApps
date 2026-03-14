
'use client';

import React, { Suspense } from 'react';
import ViewCardClient from '@/components/dashboard/advance-tools/qr-business-card/[id]/view-card-client';
import ViewDigitalBusinessCardLoadingSkeleton from './loading';

export default function ViewCardPage({ params }: { params: { id: string } }) {
  const cardId = params.id;
  
  if (!cardId) {
    return <div>Invalid Card ID.</div>;
  }
  
  return (
    <Suspense fallback={<ViewDigitalBusinessCardLoadingSkeleton />}>
      <ViewCardClient cardId={cardId} />
    </Suspense>
  );
}
