
import { adminDb } from '@/lib/firebase-admin-init';
import type { ListingItem } from '@/types';
import { AlertTriangle, Globe, Mail, Phone, Building, UserCircle, Info, Linkedin, Twitter, MapPin, DollarSign, Repeat, Store, Tag, CalendarDays, Image as ImageIcon, User } from "lucide-react";
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { APP_NAME } from '@/lib/constants';
import type { Metadata, ResolvingMetadata } from 'next';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

async function getListingData(id: string): Promise<ListingItem | null> {
  if (!id) return null;
  try {
    const listingDocRef = adminDb.collection("listingItems").doc(id);
    const listingSnap = await listingDocRef.get();
    if (listingSnap.exists) { 
      const data = listingSnap.data() as ListingItem;
      // For public view, only show active listings
      if (data.status === 'active') {
        return { id: listingSnap.id, ...data };
      }
      return null; // Not active, so not publicly viewable
    }
    return null;
  } catch (error) {
    console.error("Error fetching public listing data:", error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { listingId: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const listing = await getListingData(params.listingId);
  const previousImages = (await parent).openGraph?.images || []

  if (!listing) {
    return {
      title: `Listing Not Found | ${APP_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const title = `${listing.title} - ${listing.itemType.charAt(0).toUpperCase() + listing.itemType.slice(1)} | Marketplace | ${APP_NAME}`;
  const description = `View details for "${listing.title}", a ${listing.itemType} listing on ${APP_NAME}. ${listing.description.substring(0,150)}...`;
  
  const ogImages = [];
  if (listing.imageUrls && listing.imageUrls.length > 0) {
    ogImages.push({ url: listing.imageUrls[0], alt: listing.title });
  }


  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'website',
      images: [...ogImages, ...previousImages],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: listing.imageUrls && listing.imageUrls.length > 0 ? [listing.imageUrls[0]] : [],
    },
    robots: { index: true, follow: true }, 
  };
}

const formatCurrency = (amount: number | undefined | null) => {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy, p'); } catch (e) { return dateString; }
};


export default async function PublicListingViewPage({ params: { listingId } }: { params: { listingId: string } }) {
  const listing = await getListingData(listingId);

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Listing Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The listing you are looking for (ID: {listingId}) could not be found, it may no longer be active, or access is restricted.
        </p>
      </div>
    );
  }
  
  const cardAccentColor = 'hsl(var(--primary))'; // Using default color for public view consistency
  
  const publicShareLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/view/listing/${listing.id}`
    : `https://your-domain.com/view/listing/${listing.id}`;
    
  const qrCodeDataUrl = await QRCode.toDataURL(publicShareLink, { errorCorrectionLevel: 'H', type: 'image/png', margin: 1, width: 256 }).catch(err => {
    console.error("QR Code generation failed:", err);
    return null;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <Card className="shadow-xl max-w-lg w-full">
        <CardHeader className="p-6">
          <div className="flex justify-between items-start gap-2 mb-2">
            <CardTitle className="text-2xl font-bold text-primary">{listing.title}</CardTitle>
            <Badge variant={listing.itemType === 'sell' ? 'default' : listing.itemType === 'buy' ? 'secondary' : 'outline'} className="capitalize text-sm whitespace-nowrap flex-shrink-0">{listing.itemType}</Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 items-center">
            {listing.category && <span className="flex items-center"><Tag className="mr-1.5 h-3.5 w-3.5"/>Category: {listing.category}</span>}
            <span className="flex items-center"><CalendarDays className="mr-1.5 h-3.5 w-3.5"/>Posted: {formatDate(listing.createdAt)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4 text-sm">
          {listing.imageUrls && listing.imageUrls.length > 0 && (
            <div>
              <h3 className="font-semibold text-md mb-2">Images</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {listing.imageUrls.slice(0, 4).map((url, index) => ( // Show up to 4 images
                  <div key={index} className={cn("relative aspect-video rounded-md overflow-hidden border", listing.imageUrls!.length === 1 ? "sm:col-span-2" : "")}>
                    <Image src={url} alt={`Listing image ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint="product photo"/>
                  </div>
                ))}
              </div>
            </div>
          )}
           {(!listing.imageUrls || listing.imageUrls.length === 0) && (
             <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md p-3 bg-secondary/30">
                <ImageIcon className="h-5 w-5" /> No images provided for this listing.
            </div>
          )}
          <Separator />
          <div>
            <h3 className="font-semibold text-md mb-1 text-gray-800">Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
          </div>
          <Separator />
          <div className="grid md:grid-cols-2 gap-4 items-start">
            {listing.itemType === 'sell' && listing.price != null && (
              <div className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="font-semibold text-gray-800">Price:</span> <span className="text-gray-700">{formatCurrency(listing.price)}</span>
              </div>
            )}
            {listing.itemType === 'buy' && listing.price != null && (
              <div className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-gray-800">Budget:</span> <span className="text-gray-700">{formatCurrency(listing.price)}</span>
              </div>
            )}
            {listing.itemType === 'exchange' && listing.exchangeFor && (
              <div className="flex items-start gap-2 col-span-full">
                <Repeat className="h-5 w-5 text-blue-600 mt-0.5" />
                <div><span className="font-semibold text-gray-800">Looking to Exchange For:</span> <p className="text-muted-foreground">{listing.exchangeFor}</p></div>
              </div>
            )}
            
            <div>
              <h3 className="font-semibold text-md mb-2 flex items-center text-gray-800"><MapPin className="mr-2 h-5 w-5 text-primary" />Location</h3>
              <div className="text-sm text-muted-foreground space-y-0.5">
                {listing.addressLine1 && <p>{listing.addressLine1}</p>}
                {listing.addressLine2 && <p>{listing.addressLine2}</p>}
                {listing.localityOrArea && <p>{listing.localityOrArea}</p>}
                <p>
                  {listing.city && <span>{listing.city}, </span>}
                  {listing.district && <span>{listing.district}, </span>}
                  {listing.state && <span>{listing.state} </span>}
                  {listing.pincode && <span>({listing.pincode})</span>}
                </p>
                {listing.country && <p>{listing.country}</p>}
                {!listing.addressLine1 && !listing.city && <p>Not specified</p>}
              </div>
            </div>
          </div>
           <Separator />
            <div>
                <h3 className="font-semibold text-md mb-2 flex items-center text-gray-800"><UserCircle className="mr-2 h-5 w-5 text-primary"/>Contact Information</h3>
                {listing.contactName && <div className="flex items-center gap-2 mb-1"><User className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-gray-700">{listing.contactName}</span></div>}
                {listing.contactPhone && <div className="flex items-center gap-2 mb-1"><Phone className="h-4 w-4 text-muted-foreground" /><a href={`tel:${listing.contactPhone}`} className="text-sm text-gray-700 hover:underline">{listing.contactPhone}</a></div>}
                {listing.contactEmail && <div className="flex items-center gap-2 mb-1"><Mail className="h-4 w-4 text-muted-foreground" /><a href={`mailto:${listing.contactEmail}`} className="text-sm text-gray-700 hover:underline">{listing.contactEmail}</a></div>}
                {(!listing.contactName && !listing.contactPhone && !listing.contactEmail) && <p className="text-sm text-muted-foreground mb-1">Contact details not fully specified by lister.</p>}
            </div>
             {listing.createdByName && 
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t mt-3">
                    <User className="h-3.5 w-3.5"/> Lister: {listing.createdByName}
                </div>
            }
        </CardContent>
         <CardFooter className="p-4 border-t text-center bg-gray-50">
            <p className="text-xs text-muted-foreground">Shared via {APP_NAME}</p>
         </CardFooter>
      </Card>
    </div>
  );
}
