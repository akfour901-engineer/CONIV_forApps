'use client';

import React, { Suspense } from 'react';
import SettingsClientPage from '@/components/settings/settings-client-page';
import { useAuth } from '@/hooks/use-auth';

export default function SettingsPage() {
    const { user, userProfile, appConfig, refreshContext, loading } = useAuth();

    if (loading || !user || !userProfile) {
        return <div className="p-8 text-center">Loading settings...</div>;
    }

    return (
        <Suspense fallback={<div className="p-8 text-center">Loading settings...</div>}>
            <SettingsClientPage 
                user={user} 
                userProfile={userProfile} 
                appConfig={appConfig} 
                refreshContext={refreshContext} 
            />
        </Suspense>
    );
}