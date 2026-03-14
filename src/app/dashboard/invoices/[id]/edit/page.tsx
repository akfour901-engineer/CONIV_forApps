
'use client';

import React, { Suspense } from 'react';
import EditInvoicePageSkeleton from './loading';
import EditInvoicePageContent from '@/components/invoices/edit-invoice-client';


export default function EditInvoicePage({ params }: { params: { id: string } }) {
  const invoiceId = params.id;

  if (!invoiceId) {
    return <div>Invalid Invoice ID.</div>;
  }

  return (
    <Suspense fallback={<EditInvoicePageSkeleton />}>
      <EditInvoicePageContent invoiceId={invoiceId} />
    </Suspense>
  );
}
