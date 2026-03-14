
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { ListingItem } from '@/types/server-only';
import { format, parseISO } from 'date-fns';
import ViewListingLoadingSkeleton from '@/app/dashboard/advance-tools/buy-sell-exchange/[id]/loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Edit, AlertTriangle, Tag, CalendarDays, DollarSign, Repeat, MapPin, User, Phone, Mail, Building, ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface ViewListingClientPageProps {
  listingId: string;
}

export default function ViewListingClientPage({ listingId }: ViewListingClientPageProps) {
  const { user, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [listing, setListing] = useState<ListingItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchListing = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/listings/${listingId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          throw new Error((await response.json()).error || 'Failed to fetch listing details.');
        }
        setListing(await response.json());
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchListing();
  }, [listingId, user, authLoading, toast]);
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) { return 'Invalid Date'; }
  };
  
  if (isLoading || authLoading) return <ViewListingLoadingSkeleton />;
  
  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Listing Not Found</h2>
        <p className="text-muted-foreground">The requested listing could not be found or you do not have permission to view it.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/advance-tools/buy-sell-exchange">Back to Marketplace</Link></Button>
      </div>
    );
  }
  
  const canEdit = user?.uid === listing.userId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/dashboard/advance-tools/buy-sell-exchange"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace</Link>
        </Button>
        {canEdit && (
            <Button asChild>
                <Link href={`/dashboard/advance-tools/buy-sell-exchange/${listing.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Listing</Link>
            </Button>
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <CardTitle className="text-2xl font-bold">{listing.title}</CardTitle>
            <Badge variant={listing.itemType === 'sell' ? 'default' : listing.itemType === 'buy' ? 'secondary' : 'outline'} className="capitalize text-sm whitespace-nowrap">{listing.itemType}</Badge>
          </div>
          <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {listing.category && <span className="flex items-center"><Tag className="mr-1.5 h-3.5 w-3.5"/>Category: {listing.category}</span>}
            <span className="flex items-center"><CalendarDays className="mr-1.5 h-3.5 w-3.5"/>Posted: {formatDate(listing.createdAt)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {listing.imageUrls && listing.imageUrls.length > 0 ? (
            <Carousel className="w-full max-w-full">
              <CarouselContent>
                {listing.imageUrls.map((url, index) => (
                  <CarouselItem key={index}>
                    <div className="p-1">
                      <Card className="overflow-hidden">
                        <CardContent className="flex aspect-video items-center justify-center p-0">
                          <Image src={url} alt={`Listing image ${index + 1}`} width={1280} height={720} className="w-full h-full object-cover" data-ai-hint="product photo"/>
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          ) : (
             <Alert variant="default" className="bg-secondary">
                <AlertTitle>No Images</AlertTitle>
                <AlertDescription>The lister did not provide any images for this item.</AlertDescription>
            </Alert>
          )}

          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-1">Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
          </div>
          <Separator />
          
          <div className="grid md:grid-cols-2 gap-6 items-start">
             <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                    {listing.itemType === 'sell' && <DollarSign className="mr-2 h-5 w-5 text-green-600"/>}
                    {listing.itemType === 'buy' && <DollarSign className="mr-2 h-5 w-5 text-blue-600"/>}
                    {listing.itemType === 'exchange' && <Repeat className="mr-2 h-5 w-5 text-purple-600"/>}
                    {listing.itemType === 'sell' ? 'Price' : listing.itemType === 'buy' ? 'Budget' : 'Exchange For'}
                </h3>
                 <p className="text-2xl font-bold">{listing.price ? formatCurrency(listing.price) : (listing.exchangeFor || "Not Specified")}</p>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary"/>Location</h3>
                <p>{listing.addressLine1}</p>
                <p>{listing.city}{listing.state && `, ${listing.state}`} {listing.pincode}</p>
            </div>
          </div>
          
          <Separator/>
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center"><User className="mr-2 h-5 w-5 text-primary"/>Contact Information</h3>
            <div className="space-y-1">
                {listing.contactName && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><p>{listing.contactName}</p></div>}
                {listing.contactPhone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><p>{listing.contactPhone}</p></div>}
                {listing.contactEmail && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><p>{listing.contactEmail}</p></div>}
                {listing.companyName && <div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground"/><p>{listing.companyName}</p></div>}
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
