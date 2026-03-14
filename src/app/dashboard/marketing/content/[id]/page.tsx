'use client';

import React, { Suspense } from 'react';
import MailingListLoading from '@/app/dashboard/marketing/content/loading';
import EditMarketingContentClient from '@/components/marketing/edit-content-client';

export default function EditMarketingContentPage({ params }: { params: { id: string } }) {
  const contentId = params.id;

  if (!contentId) {
    return <div>Invalid Content ID</div>;
  }

  return (
    <Suspense fallback={<MailingListLoading />}>
      <EditMarketingContentClient contentId={contentId} />
    </Suspense>
  );
}