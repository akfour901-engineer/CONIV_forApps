// app/home/page.tsx – Safe entry point after splash
// Shows your real GlobalLoadingIndicator during auth check & redirect

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { GlobalLoadingIndicator} from '@/components/layout/global-loading-indicator'; // ← your component

export default function HomeEntryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/'); // or '/login' if you have a separate login page
      }
    }
  }, [user, loading, router]);

  // Show your global loading indicator while checking auth / redirecting
  return <GlobalLoadingIndicator />;
}