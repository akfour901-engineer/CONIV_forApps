
import { adminDb } from '@/lib/firebase-admin-init';
import type { DigitalBusinessCard } from '@/types';
import { AlertTriangle, Globe, Mail, Phone, Building, UserCircle, Info, Linkedin, Twitter, MapPin } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { APP_NAME } from '@/lib/constants';
import type { Metadata, ResolvingMetadata } from 'next';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

async function getCardData(publicViewId: string): Promise<DigitalBusinessCard | null> {
  if (!publicViewId) return null;
  try {
    const q = adminDb.collection("digitalBusinessCards").where("publicViewId", "==", publicViewId).limit(1);
    const snapshot = await q.get();
    if (!snapshot.empty) {
      const docData = snapshot.docs[0].data();
      return { id: snapshot.docs[0].id, ...docData } as DigitalBusinessCard;
    }
    return null;
  } catch (error) {
    console.error("Error fetching public card data:", error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { publicViewId: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const card = await getCardData(params.publicViewId);
  const previousImages = (await parent).openGraph?.images || []

  if (!card) {
    return {
      title: `Card Not Found | ${APP_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const title = `${card.fullName}${card.companyName ? ` - ${card.companyName}` : ''} | Digital Card | ${APP_NAME}`;
  const description = `View the digital business card for ${card.fullName}${card.title ? `, ${card.title}` : ''}${card.companyName ? ` at ${card.companyName}` : ''}. Shared via ${APP_NAME}.`;
  
  const ogImages = [];
  if (card.profilePictureUrl) ogImages.push({ url: card.profilePictureUrl, width: 100, height: 100, alt: `${card.fullName} Profile`});
  if (card.logoUrl) ogImages.push({ url: card.logoUrl, width: 80, height: 80, alt: `${card.companyName || card.fullName} Logo` });


  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'profile',
      images: [...ogImages, ...previousImages],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: card.profilePictureUrl ? [card.profilePictureUrl] : (card.logoUrl ? [card.logoUrl] : []),
    },
    robots: { index: true, follow: true }, 
  };
}

export default async function PublicDigitalBusinessCardPage({ params }: { params: { publicViewId: string } }) {
  const publicViewId = params.publicViewId;
  const card = await getCardData(publicViewId);

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Digital Card Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The digital business card you are looking for (ID: {publicViewId}) could not be found or is no longer available.
        </p>
      </div>
    );
  }
  
  const cardAccentColor = card.customColor || 'hsl(var(--primary))';
  
  const publicShareLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/view/card/${card.publicViewId}`
    : `https://your-domain.com/view/card/${card.publicViewId}`;
    
  const qrCodeDataUrl = await QRCode.toDataURL(publicShareLink, { errorCorrectionLevel: 'H', type: 'image/png', margin: 1, width: 256 }).catch(err => {
    console.error("QR Code generation failed:", err);
    return null;
  });

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 sm:p-6">
      <Card className="shadow-2xl max-w-sm w-full overflow-hidden rounded-2xl bg-card">
        <div className="relative h-24" style={{ backgroundColor: cardAccentColor }}>
          {card.logoUrl && (
            <div className="absolute top-3 right-3 h-12 w-12 bg-white/80 p-1 rounded-md flex items-center justify-center backdrop-blur-sm">
              <Image src={card.logoUrl} alt={`${card.companyName || card.fullName} logo`} layout="fill" objectFit="contain" className="p-1" data-ai-hint="company logo"/>
            </div>
          )}
           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
             <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-card bg-card shadow-lg">
                <Image src={card.profilePictureUrl || 'https://placehold.co/128x128.png'} alt={card.fullName} layout="fill" objectFit="cover" data-ai-hint="person avatar"/>
             </div>
           </div>
        </div>
        
        <div className="pt-16 pb-6 text-center">
          <CardTitle className="text-2xl font-bold text-foreground">{card.fullName}</CardTitle>
          {card.title && <p className="text-md text-muted-foreground">{card.title}</p>}
          {card.companyName && <p className="text-lg font-semibold text-primary">{card.companyName}</p>}
        </div>

        <CardContent className="px-6 pb-6 space-y-4 text-sm">
            {card.phoneNumber && <a href={`tel:${card.phoneNumber}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><Phone className="h-5 w-5 text-primary" /><span className="text-foreground">{card.phoneNumber}</span></a>}
            {card.email && <a href={`mailto:${card.email}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><Mail className="h-5 w-5 text-primary" /><span className="text-foreground">{card.email}</span></a>}
            {card.website && <a href={card.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><Globe className="h-5 w-5 text-primary" /><span className="text-foreground truncate">{card.website}</span></a>}
            {card.address && <div className="flex items-start gap-3 p-2 rounded-lg"><MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" /><p className="text-foreground">{card.address}</p></div>}
             {(card.linkedIn || card.twitter) && <Separator className="my-2"/>}
            <div className="flex justify-center gap-4">
              {card.linkedIn && <a href={card.linkedIn} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-700" aria-label="LinkedIn" title="LinkedIn"><Linkedin className="h-6 w-6" /></a>}
              {card.twitter && <a href={card.twitter.startsWith('http') ? card.twitter : `https://twitter.com/${card.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-sky-500" aria-label="X (Twitter)" title="X (Twitter)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zM17.5 19.5h1.5l-6.52-8.625L7 3.5H5.5l7.155 9.485L17.5 19.5z" /></svg>
              </a>}
            </div>
             {card.notes && <><Separator className="my-2"/><div className="flex items-start gap-3 p-2 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0 mt-0.5" /><p className="whitespace-pre-wrap">{card.notes}</p></div></>}
        </CardContent>
         
         <CardFooter className="p-4 border-t bg-secondary/30 flex flex-col items-center space-y-2">
            {qrCodeDataUrl ? (
                <Image src={qrCodeDataUrl} alt="QR Code" width={128} height={128} className="border-4 border-white rounded-lg shadow-md" data-ai-hint="qr code"/>
            ) : (
                <div className="w-32 h-32 flex items-center justify-center border-4 border-white bg-gray-200 text-muted-foreground text-xs text-center p-2 rounded-lg">QR Code unavailable</div>
            )}
            <p className="text-xs text-muted-foreground text-center">Scan this code to save my contact details.</p>
         </CardFooter>
      </Card>
    </div>
  );
}
