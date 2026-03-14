'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import DashboardLoadingSkeleton from '@/app/dashboard/loading';
import { Button } from '@/components/ui/button';

import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { LandingPageHeader } from './landing/landing-page-header';
import { HeroSection } from './landing/hero-section';
import { WorkflowSection } from './landing/workflow-section';
import { CapabilitiesSection } from './landing/capabilities-section';
import { WhyUsSection } from './landing/why-us-section';
import { TrustSection } from './landing/trust-section';
import { AppDownloadSection } from './landing/app-download-section';
import { CtaSection } from './landing/cta-section';
import { PublicFooter } from './landing/public-footer';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // This setup doesn't require authentication, so we don't redirect.
  }, [user, loading, router]);
  
  if (loading) {
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
