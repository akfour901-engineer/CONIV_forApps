
'use client';

import { useEffect, useState } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Edit, Download, Loader2, AlertTriangle, FileText, UploadCloud, CheckCircle, IndianRupee, Link as LinkIcon, QrCode, Globe, Mail, Phone, Building, UserCircle, Info, Linkedin, Twitter, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { DigitalBusinessCard } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import ViewCardLoadingSkeleton from './loading';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import QRCode from 'qrcode';

export default function ViewCardClientPage({ cardId }: { cardId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [card, setCard] = useState<DigitalBusinessCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    if (!cardId) {
      toast({ title: "Error", description: "Card ID is missing.", variant: "destructive" });
      router.push('/dashboard/advance-tools/qr-business-card');
      return;
    }

    const fetchCard = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/digital-business-cards/${cardId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch card details`);
        }
        const data: DigitalBusinessCard = await response.json();
        setCard(data);

        // Generate QR Code
        if (data.publicViewId) {
            const shareableLink = `${window.location.origin}/view/card/${data.publicViewId}`;
            QRCode.toDataURL(shareableLink, { errorCorrectionLevel: 'H', type: 'image/png', margin: 1, width: 200 })
              .then(url => setQrCodeDataUrl(url))
              .catch(err => console.error("QR Code generation failed:", err));
        }

      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setCard(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCard();
  }, [cardId, user, authLoading, toast, router]);

  if (isLoading || authLoading) {
    return <ViewCardLoadingSkeleton />;
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Card Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested card could not be found or you do not have permission to view it.</p>
        <Button asChild variant="outline"> <Link href="/dashboard/advance-tools/qr-business-card"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link> </Button>
      </div>
    );
  }

  const copyPublicLink = () => {
    const link = `${window.location.origin}/view/card/${card.publicViewId}`;
    navigator.clipboard.writeText(link)
      .then(() => toast({ title: "Link Copied!", description: "The public view link has been copied to your clipboard."}))
      .catch(() => toast({ title: "Copy Failed", variant: "destructive" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/advance-tools/qr-business-card"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{card.cardName}</h1>
            <p className="text-muted-foreground">Digital Business Card Preview</p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={copyPublicLink}><LinkIcon className="mr-2 h-4 w-4"/>Copy Public Link</Button>
            <Button asChild><Link href={`/dashboard/advance-tools/qr-business-card/${card.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit Card</Link></Button>
        </div>
      </div>
       <Card className="shadow-2xl max-w-sm w-full mx-auto overflow-hidden rounded-2xl bg-card">
          <div className="relative h-24" style={{ backgroundColor: card.customColor || 'hsl(var(--primary))' }}>
            {card.logoUrl && (
              <div className="absolute top-3 right-3 h-12 w-12 bg-white/80 p-1 rounded-md flex items-center justify-center backdrop-blur-sm">
                <Image src={card.logoUrl} alt={`${card.companyName || card.fullName} logo`} width={48} height={48} objectFit="contain" data-ai-hint="company logo"/>
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
            {card.companyName && <p className="text-lg font-semibold" style={{color: card.customColor || 'hsl(var(--primary))'}}>{card.companyName}</p>}
          </div>

          <CardContent className="px-6 pb-6 space-y-4 text-sm">
              {card.phoneNumber && <a href={`tel:${card.phoneNumber}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><Phone className="h-5 w-5 text-primary" /><span className="text-foreground">{card.phoneNumber}</span></a>}
              {card.email && <a href={`mailto:${card.email}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><Mail className="h-5 w-5 text-primary" /><span className="text-foreground">{card.email}</span></a>}
              {card.website && <a href={card.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><Globe className="h-5 w-5 text-primary" /><span className="text-foreground truncate">{card.website}</span></a>}
              {card.address && <div className="flex items-start gap-3 p-2 rounded-lg"><MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" /><p className="text-foreground">{card.address}</p></div>}
              {(card.linkedIn || card.twitter) && <Separator />}
              <div className="flex justify-center gap-4">
                {card.linkedIn && <a href={card.linkedIn} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-700" aria-label="LinkedIn" title="LinkedIn"><Linkedin className="h-6 w-6" /></a>}
                {card.twitter && <a href={card.twitter.startsWith('http') ? card.twitter : `https://twitter.com/${card.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-sky-500" aria-label="X (Twitter)" title="X (Twitter)">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zM17.5 19.5h1.5l-6.52-8.625L7 3.5H5.5l7.155 9.485L17.5 19.5z" /></svg>
                </a>}
              </div>
              {card.notes && <><Separator /><div className="flex items-start gap-3 p-2 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0 mt-0.5" /><p className="whitespace-pre-wrap">{card.notes}</p></div></>}
          </CardContent>
           
           <CardFooter className="p-4 border-t bg-secondary/30 flex flex-col items-center space-y-2">
              {qrCodeDataUrl ? (
                  <Image src={qrCodeDataUrl} alt="QR Code" width={128} height={128} className="border-4 border-white rounded-lg shadow-md" data-ai-hint="qr code"/>
              ) : (
                  <div className="w-32 h-32 flex items-center justify-center border-4 border-white bg-gray-200 text-muted-foreground text-xs text-center p-2 rounded-lg">QR Code generating...</div>
              )}
              <p className="text-xs text-muted-foreground text-center">Scan this code to save my contact details.</p>
           </CardFooter>
        </Card>
    </div>
  );
}
