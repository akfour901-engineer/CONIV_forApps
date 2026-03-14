
'use client';

import React, { Suspense } from 'react';
import EditLicenseClient from '@/components/licenses/edit-license-client';
import EditLicenseLoadingSkeleton from './loading';

export default function EditLicensePage({ params }: { params: { id: string } }) {
  const licenseId = params.id;

  if (!licenseId) {
    return <div>Invalid License ID.</div>;
  }

  return (
    <Suspense fallback={<EditLicenseLoadingSkeleton />}>
      <EditLicenseClient licenseId={licenseId} />
    </Suspense>
  );
}
