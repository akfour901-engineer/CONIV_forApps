import { adminDb } from '@/lib/firebase-admin-init';
import type { Portfolio } from '@/types';  // ← Changed to safe @/types import (assuming your barrel exports it)
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/constants';
import PortfolioClientPage from './portfolio-client-page';
import { Suspense } from 'react';
import PublicPortfolioLoading from './loading';

export const revalidate = 0; // Force dynamic rendering

async function getPortfolioData(publicId: string): Promise<Portfolio | null> {
  if (!publicId) return null;

  try {
    const portfolioQuery = adminDb
      .collection('portfolios')
      .where('publicId', '==', publicId)
      .limit(1);

    const portfolioSnapshot = await portfolioQuery.get();

    if (portfolioSnapshot.empty) {
      return null;
    }

    return {
      id: portfolioSnapshot.docs[0].id,
      ...portfolioSnapshot.docs[0].data(),
    } as Portfolio;
  } catch (error) {
    console.error(`Error fetching public portfolio for ID ${publicId}:`, error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { publicId: string };
}): Promise<Metadata> {
  const portfolio = await getPortfolioData(params.publicId);

  if (!portfolio) {
    return {
      title: `Portfolio Not Found | ${APP_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const title = `${portfolio.portfolioName || 'Public Portfolio'} | ${
    portfolio.companyName || 'Portfolio'
  } | ${APP_NAME}`;
  const description = `View the public portfolio for ${portfolio.portfolioName}. Shared via ${APP_NAME}.`;

  const ogImages = [];
  if (portfolio.companyLogoUrl) {
    ogImages.push({ url: portfolio.companyLogoUrl, alt: `${portfolio.companyName} Logo` });
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: ogImages.length > 0 ? ogImages : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages.length > 0 ? [ogImages[0].url] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicPortfolioPage({
  params,
}: {
  params: { publicId: string };
}) {
  const portfolio = await getPortfolioData(params.publicId);

  if (!portfolio || !portfolio.content) {
    notFound();
  }

  return (
    <Suspense fallback={<PublicPortfolioLoading />}>
      <PortfolioClientPage portfolio={portfolio} />
    </Suspense>
  );
}