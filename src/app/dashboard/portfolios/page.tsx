
'use client';

import React from 'react';
import PortfoliosClientPage from '@/components/portfolios/portfolios-client-page';
import AiPortfolioGenerator from '@/components/dashboard/advance-tools/ai-portfolio-generator/ai-portfolio-generator-client';

export default function PortfoliosPage() {
    return (
        <div className="space-y-6">
            <AiPortfolioGenerator />
            <PortfoliosClientPage />
        </div>
    );
}
