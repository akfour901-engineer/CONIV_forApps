'use client';

import React, { Suspense } from 'react';
import NewDocumentPageSkeleton from './loading';
import NewDocumentPageContent from '@/components/documents/new-document-client';

export default function NewDocumentPage() {
    return (
        <Suspense fallback={<NewDocumentPageSkeleton />}>
            <NewDocumentPageContent />
        </Suspense>
    );
}
