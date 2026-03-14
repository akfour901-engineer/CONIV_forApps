
'use client';

import React, { Suspense } from 'react';
import TeamPageContent from '@/components/team/team-client';
import TeamLoadingSkeleton from './loading';

export default function ManageTeamPage() {
    return (
        <Suspense fallback={<TeamLoadingSkeleton />}>
            <TeamPageContent />
        </Suspense>
    );
}
