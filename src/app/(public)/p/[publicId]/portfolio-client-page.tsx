'use client';

import type { Portfolio } from '@/types/server-only';
import PublicContactForm from '@/components/portfolios/public-contact-form';
import { useState, useEffect } from 'react';

export default function PortfolioClientPage({ portfolio }: { portfolio: Portfolio }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use a placeholder that will be replaced by the portal target
  const contactFormHtml = '<div id="contact-form-placeholder"></div>';
  const finalHtml = portfolio.content.replace(/\[CONTACT_FORM\]/gi, contactFormHtml);

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: finalHtml }} />
      {/* 
        The PublicContactForm component uses React's createPortal to find the 
        'contact-form-placeholder' div within the dangerouslySetInnerHTML 
        content and render itself inside it. We ensure it only runs on the client.
      */}
      {isMounted && (
        <PublicContactForm
          portfolioId={portfolio.id!}
          portfolioOwnerId={portfolio.userId}
          portfolioName={portfolio.portfolioName}
        />
      )}
    </div>
  );
}
