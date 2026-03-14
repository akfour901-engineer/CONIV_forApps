
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface ViewCardClientProps {
  cardId: string;
}

export default function ViewCardClient({ cardId }: ViewCardClientProps) {
  // This is a placeholder component.
  // The actual implementation to view the card details will be built out.
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">View Card</h1>
          <p className="text-muted-foreground">Card ID: {cardId}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/advance-tools/qr-business-card">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cards
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>The view for your digital business card will be displayed here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
