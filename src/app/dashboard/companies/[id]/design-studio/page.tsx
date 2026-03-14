
'use client';

import React, { Suspense } from 'react';
import AiDesignStudioClientPage from '@/components/companies/ai-design-studio-client';
import AiDesignStudioLoadingSkeleton from './loading';

export default function AiDesignStudioPage({ params }: { params: { id: string } }) {
  const companyId = params.id;
  if (!companyId) {
    return <div>Invalid Company ID.</div>;
  }
  return (
    <Suspense fallback={<AiDesignStudioLoadingSkeleton />}>
      <AiDesignStudioClientPage companyId={companyId} />
    </Suspense>
  );
}
