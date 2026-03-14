
'use client';

import React, { Suspense } from 'react';
import AppLayoutClient from '@/components/layout/app-layout-client';
import DashboardLoadingSkeleton from './loading';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <AppLayoutClient>
          {children}
      </AppLayoutClient>
  );
}
