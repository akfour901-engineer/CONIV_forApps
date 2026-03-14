'use client';

import React, { Suspense } from 'react';
import FollowUpForm from '@/components/follow-ups/follow-up-form';
import EditFollowUpLoadingSkeleton from './loading';

export default function EditFollowUpPage({ params }: { params: { id: string }}) {
  const followUpId = params.id;

  if (!followUpId) {
    return <div>Invalid Follow-up ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditFollowUpLoadingSkeleton />}>
      <FollowUpForm followUpId={followUpId} />
    </Suspense>
  );
}