
'use client';

import React, { Suspense } from 'react';
import CompanyDetailLoadingSkeleton from './loading';
import CompanyDetailClientPage from '@/components/dashboard/companies/company-detail-client';

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const companyId = params.id;
  
  if (!companyId) {
    return <div>Invalid company ID.</div>;
  }
  
  return (
    <Suspense fallback={<CompanyDetailLoadingSkeleton />}>
       <CompanyDetailClientPage companyId={companyId} />
    </Suspense>
  );
}
