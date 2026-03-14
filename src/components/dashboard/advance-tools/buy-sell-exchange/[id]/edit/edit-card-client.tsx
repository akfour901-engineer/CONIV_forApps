'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface EditListingClientPageProps {
  listingId: string;
}

export default function EditListingClientPage({ listingId }: EditListingClientPageProps) {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit Listing</h1>
          <p className="text-muted-foreground">Editing listing ID: {listingId}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/advance-tools/buy-sell-exchange">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>The form to edit your marketplace listing will be available here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
