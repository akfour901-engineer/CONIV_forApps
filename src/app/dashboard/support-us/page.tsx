
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Heart } from 'lucide-react';
import { SupportContributionCard } from '@/components/support/support-contribution-card';
import { APP_NAME } from '@/lib/constants';

export default function SupportUsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Heart className="mr-3 h-7 w-7 text-red-500" /> Support {APP_NAME}
          </h1>
          <p className="text-muted-foreground">
            If you find our app useful, please consider supporting its development.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Contribution Matters</CardTitle>
          <CardDescription>
            Your support helps us maintain the servers, add new features, and continue providing a valuable tool for the community.
            Choose an amount below or enter a custom one to contribute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupportContributionCard />
        </CardContent>
      </Card>
    </div>
  );
}
