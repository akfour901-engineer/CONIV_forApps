'use client';

import React, { Suspense } from 'react';
import LetterForm from '@/components/letter-generation/letter-form';
import LetterGenerationLoadingSkeleton from '@/app/dashboard/letter-generation/loading';

export default function LetterPage({ params }: { params: { id: string }}) {
  const letterId = params.id;

  return (
    <Suspense fallback={<LetterGenerationLoadingSkeleton />}>
        <LetterForm letterId={letterId === 'new' ? undefined : letterId} />
    </Suspense>
  );
}