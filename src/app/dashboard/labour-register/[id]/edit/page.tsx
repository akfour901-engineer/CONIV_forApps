'use client';

import React, { Suspense } from 'react';
import EditLabourRegisterLoading from './loading';
import EditLabourRegisterPageContent from './edit-labour-client';

export default function EditLabourRegisterPage({ params }: { params: { id: string } }) {
  const labourerId = params.id;

  if (!labourerId) {
    return <div>Invalid Labourer ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditLabourRegisterLoading />}>
      <EditLabourRegisterPageContent labourerId={labourerId} />
    </Suspense>
  );
}