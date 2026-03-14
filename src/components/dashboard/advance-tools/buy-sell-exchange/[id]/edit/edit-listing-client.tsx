
'use client';

import React from 'react';
import NewListingForm from '@/components/dashboard/advance-tools/buy-sell-exchange/new/new-listing-client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLoading } from '@/contexts/loading-context';

interface EditListingClientPageProps {
  listingId: string;
}

export default function EditListingClientPage({ listingId }: EditListingClientPageProps) {
  const { setIsLoading } = useLoading();
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit Listing</h1>
          <p className="text-muted-foreground">Editing listing ID: {listingId}</p>
        </div>
        <Button variant="outline" asChild onClick={() => setIsLoading(true)}>
          <Link href="/dashboard/advance-tools/buy-sell-exchange">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
          </Link>
        </Button>
      </div>
      <NewListingForm listingId={listingId} />
    </div>
  );
}
