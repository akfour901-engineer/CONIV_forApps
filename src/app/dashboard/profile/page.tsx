'use client';

import React, { Suspense } from 'react';
import ProfileClientPage from '@/components/profile/profile-client-page';
import { useAuth } from '@/hooks/use-auth';

export default function ProfilePage() {
    const { user, userProfile, appConfig, refreshContext, loading } = useAuth();

    if (loading || !user || !userProfile) {
        return <div className="p-8 text-center">Loading profile...</div>;
    }

    return (
        <Suspense fallback={<div className="p-8 text-center">Loading profile...</div>}>
            <ProfileClientPage 
                user={user} 
                userProfile={userProfile} 
                appConfig={appConfig} 
                refreshContext={refreshContext} 
            />
        </Suspense>
    );
}