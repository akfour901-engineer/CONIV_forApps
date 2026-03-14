
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Download, Laptop, Smartphone } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InstallPwaButton } from '@/components/ui/install-pwa-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLoading } from '@/contexts/loading-context';

export default function InstallAppPage() {
  const { appConfig, loading: authLoading } = useAuth();
  const { setIsLoading } = useLoading();

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
      </div>
    );
  }
  
  const desktopUrl = appConfig?.desktopAppUrl;
  const mobileUrl = appConfig?.mobileAppUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Download className="mr-3 h-7 w-7 text-primary" /> Install App
          </h1>
          <p className="text-muted-foreground">
            Get the best experience by installing our app on your devices.
          </p>
        </div>
        <Button variant="outline" asChild onClick={() => setIsLoading(true)}>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progressive Web App (PWA)</CardTitle>
          <CardDescription>
            Install the web app directly to your device for an app-like experience. Works on desktop and mobile. This is the recommended option for most users.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <InstallPwaButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desktop App (Windows)</CardTitle>
          <CardDescription>
            Download the dedicated desktop application for Windows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {desktopUrl ? (
            <Button asChild>
              <a href={desktopUrl} download>
                <Laptop className="mr-2 h-5 w-5" /> Download for Windows (.exe)
              </a>
            </Button>
          ) : (
             <Alert variant="default" className="bg-secondary">
              <AlertTitle>Not Available</AlertTitle>
              <AlertDescription>
                A dedicated desktop application is not available for download at this time. Please use the PWA install option.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mobile App (Android)</CardTitle>
          <CardDescription>
            Download the dedicated mobile application for Android devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mobileUrl ? (
            <Button asChild>
              <a href={mobileUrl} download>
                <Smartphone className="mr-2 h-5 w-5" /> Download for Android (.apk)
              </a>
            </Button>
          ) : (
            <Alert variant="default" className="bg-secondary">
              <AlertTitle>Not Available</AlertTitle>
              <AlertDescription>
                A dedicated mobile application is not available for download at this time. Please use the PWA install option.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
