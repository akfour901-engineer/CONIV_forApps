'use client';

import React, { Suspense } from 'react';
import EditDocumentLoadingSkeleton from './loading';
import EditDocumentPageContent from './edit-document-client';

export default function EditDocumentPage({ params }: { params: { id: string } }) {
  const documentId = params.id;

  if (!documentId) {
    return <div>Invalid Document ID.</div>;
  }
  
  return (
    <Suspense fallback={<EditDocumentLoadingSkeleton />}>
      <EditDocumentPageContent documentId={documentId} />
    </Suspense>
  );
}