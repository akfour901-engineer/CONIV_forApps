'use client';

import React, { Suspense } from 'react';
import EditPortfolioLoadingSkeleton from './loading';
import EditPortfolioClientPage from '@/components/portfolios/edit-portfolio-client';

export default function EditPortfolioPage({ params }: { params: { portfolioId: string } }) {
  const portfolioId = params.portfolioId;

  if (!portfolioId) {
    return <div>Invalid Portfolio ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditPortfolioLoadingSkeleton />}>
      <EditPortfolioClientPage portfolioId={portfolioId} />
    </Suspense>
  );
}