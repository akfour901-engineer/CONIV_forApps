'use client';

import React, { Suspense } from 'react';
import OrganizationDetailLoadingSkeleton from './organization-detail-loading';
import OrganizationDetailClientPage from '@/components/dashboard/organizations/organization-detail-client';

export default function OrganizationDetailPageWrapper({ params }: { params: { id: string } }) {
  const organizationId = params.id;
  
  if (!organizationId) {
    return <div>Invalid organization ID.</div>;
  }
  
  return (
    <Suspense fallback={<OrganizationDetailLoadingSkeleton />}>
       <OrganizationDetailClientPage organizationId={organizationId} />
    </Suspense>
  );
}