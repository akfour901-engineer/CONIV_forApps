
import React, { Suspense } from 'react';
import DashboardClientPage from '@/components/dashboard/dashboard-client';
import DashboardLoadingSkeleton from './loading';


export default async function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <DashboardClientPage />
    </Suspense>
  );
}
