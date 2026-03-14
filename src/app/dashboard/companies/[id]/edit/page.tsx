
'use client';

import React, { Suspense } from 'react';
import EditCompanyLoadingSkeleton from './loading';
import CompanyDetailClientPage from '@/components/dashboard/companies/company-detail-client';

export default function EditCompanyPage({ params }: { params: { id: string } }) {
  const companyId = params.id;

  if (!companyId) {
    return <div>Invalid company ID.</div>;
  }

  return (
    <Suspense fallback={<EditCompanyLoadingSkeleton />}>
       <CompanyDetailClientPage companyId={companyId} startInEditMode={true} />
    </Suspense>
  );
}
