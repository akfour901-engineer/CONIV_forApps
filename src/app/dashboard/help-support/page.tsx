
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { UserSubmissionForm } from '@/components/support/user-submission-form';

export default function HelpSupportClientPage() {
  const { user } = useAuth();
  
  if (!user) {
    // Or a loading state
    return <p>Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Help & Support</h1>
      <Card>
        <CardHeader>
          <CardTitle>Submit a Request</CardTitle>
          <CardDescription>
            Have a question, a feature request, or encountered a bug? Let us know. We aim to respond within 24-48 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserSubmissionForm />
        </CardContent>
      </Card>
    </div>
  );
}
