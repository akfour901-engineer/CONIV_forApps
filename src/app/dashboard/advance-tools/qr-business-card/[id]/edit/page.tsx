'use client';

import React, { Suspense } from 'react';
import EditDigitalBusinessCardLoadingSkeleton from './loading';
import EditCardClientPage from './edit-card-client';

export default function EditDigitalBusinessCardPage({ params }: { params: { id: string } }) {
  const cardId = params.id;

  if (!cardId) {
    return <div>Invalid Card ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditDigitalBusinessCardLoadingSkeleton />}>
      <EditCardClientPage cardId={cardId} />
    </Suspense>
  );
}