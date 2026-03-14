'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { LandingPageHeader } from '@/components/landing/landing-page-header';
import { HeroSection } from '@/components/landing/hero-section';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { CapabilitiesSection } from '@/components/landing/capabilities-section';
import { WhyUsSection } from '@/components/landing/why-us-section';
import { TrustSection } from '@/components/landing/trust-section';
import { AppDownloadSection } from '@/components/landing/app-download-section';
import { CtaSection } from '@/components/landing/cta-section';
import { PublicFooter } from '@/components/landing/public-footer';
import DashboardLoadingSkeleton from './dashboard/loading';
import { APP_NAME } from '@/lib/constants';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    document.title = `${APP_NAME} | Contracting Business Management`;
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);
  
  if (loading || (!loading && user)) {
    return <DashboardLoadingSkeleton />;
  }

  return (
    <>
      <LandingPageHeader />
      <main className="flex-1">
        <HeroSection />
        <WorkflowSection />
        <CapabilitiesSection />
        <WhyUsSection />
        <TrustSection />
        <AppDownloadSection />
        <CtaSection />
      </main>
      <PublicFooter />
    </>
  );
}
