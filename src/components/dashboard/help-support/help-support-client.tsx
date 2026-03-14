
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MapIcon } from 'lucide-react';
import { useLoading } from '@/contexts/loading-context';

export default function HelpSupportClientPage() {
    const { setIsLoading } = useLoading();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Help & Support</h1>
      <Card>
        <CardHeader>
          <CardTitle>Application Manual & Workflow</CardTitle>
          <CardDescription>
            Confused about a feature? Our comprehensive workflow guide explains every part of the application, from setup to advanced AI tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Button asChild onClick={() => setIsLoading(true)}>
              <Link href="/dashboard/workflow-guide">
                <MapIcon className="mr-2 h-4 w-4" /> Open Workflow Guide
              </Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Submit a Support Ticket</CardTitle>
          <CardDescription>This feature is under development. Soon you`ll be able to submit tickets directly here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

