
'use server';

import { Suspense } from 'react';
import ViewInvoicePageLoadingSkeleton from './loading';
import ViewInvoicePageContent from './view-invoice-client';

export default async function ViewInvoicePageWrapper({ params }: { params: { id: string } }) {
  const invoiceId = params.id;
  
  if (!invoiceId) {
      return <div>Invalid Invoice ID</div>;
  }
  
  return (
    <Suspense fallback={<ViewInvoicePageLoadingSkeleton />}>
      <ViewInvoicePageContent invoiceId={invoiceId}/>
    </Suspense>
  );
}
