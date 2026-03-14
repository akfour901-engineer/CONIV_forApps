
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Edit, Download, Loader2, AlertTriangle, Link as LinkIconOriginal, FileText, DownloadCloud, UploadCloud, ClipboardList, PieChart, Banknote, QrCode, Copy, Eye } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import type { DigitalBusinessCard } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/loading-context';
import ViewDigitalBusinessCardLoadingSkeleton from '@/app/dashboard/advance-tools/qr-business-card/[id]/loading';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, Globe, MapPin, Linkedin, Twitter, User, UserCircle, Info, Building } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import html2canvas from 'html2canvas';


export default function ViewCardClient({ cardId }: { cardId: string }) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [card, setCard] = useState<DigitalBusinessCard | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);

  const publicUrl = useMemo(() => {
    if (typeof window !== 'undefined' && card) {
      return `${window.location.origin}/view/card/${card.publicViewId}`;
    }
    return '';
  }, [card]);

  useEffect(() => {
    if (card && publicUrl) {
      QRCode.toDataURL(publicUrl, { errorCorrectionLevel: 'H', type: 'image/png', margin: 1, width: 256 })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error("QR Code generation failed:", err));
    }
  }, [card, publicUrl]);

  useEffect(() => {
    if (!authLoading && user) {
      const fetchCard = async () => {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/digital-business-cards/${cardId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch card data.');
          setCard(await response.json());
        } catch (error: any) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      };
      fetchCard();
    }
  }, [cardId, user, authLoading, toast]);
  
  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl)
      .then(() => toast({ title: "Link Copied", description: "Public card link copied to clipboard." }))
      .catch(() => toast({ title: "Copy Failed", variant: "destructive" }));
  };
  
  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) {
      toast({ title: 'Error', description: 'QR Code not available for download.', variant: 'destructive'});
      return;
    }
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `qrcode-${card?.cardName.replace(/\s+/g, '-') || 'card'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDownloadCard = async () => {
    const cardElement = document.getElementById(`digital-business-card-to-download-${cardId}`);
    if (!cardElement) {
        toast({ title: "Download Error", description: "Could not find the card element to download.", variant: "destructive" });
        return;
    }
    setIsDownloading(true);
    try {
        const canvas = await html2canvas(cardElement, {
            useCORS: true,
            scale: 2, // Higher scale for better resolution
            backgroundColor: null, // Use transparent background
        });
        const image = canvas.toDataURL("image/png", 1.0);
        
        const link = document.createElement('a');
        link.href = image;
        link.download = `${card?.cardName?.replace(/\s+/g, '_') || 'business-card'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({ title: "Download Started", description: "Your business card image is downloading." });
    } catch (error) {
        console.error("Error generating card image:", error);
        toast({ title: "Download Failed", description: "Could not generate card image.", variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };


  if (isLoading || authLoading) return <ViewDigitalBusinessCardLoadingSkeleton />;
  if (!card) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Card Not Found</h2>
            <p className="text-muted-foreground">The card you are looking for does not exist or you do not have permission to view it.</p>
            <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
                <Link href="/dashboard/advance-tools/qr-business-card">Back to Cards</Link>
            </Button>
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">View Digital Card</h1>
          <p className="text-muted-foreground">Card: {card.cardName}</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
                <Link href="/dashboard/advance-tools/qr-business-card">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cards
                </Link>
            </Button>
            <Button asChild onClick={() => setGlobalIsLoading(true)}>
                <Link href={`/dashboard/advance-tools/qr-business-card/${card.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4"/> Edit Card
                </Link>
            </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
            <div id={`digital-business-card-to-download-${cardId}`}>
                <Card className="shadow-lg overflow-hidden">
                    <CardHeader className="flex flex-row items-start gap-4">
                        {card.profilePictureUrl && <Image src={card.profilePictureUrl} alt={card.fullName} width={80} height={80} className="rounded-full border object-cover aspect-square" data-ai-hint="person avatar"/>}
                        <div className="space-y-1">
                            <CardTitle className="text-2xl">{card.fullName}</CardTitle>
                            <CardDescription>{card.title}</CardDescription>
                            {card.companyName && <p className="font-semibold text-primary">{card.companyName}</p>}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Separator/>
                        <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{card.email || 'N/A'}</span></div>
                        <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{card.phoneNumber || 'N/A'}</span></div>
                        <div className="flex items-center gap-3"><Globe className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{card.website || 'N/A'}</span></div>
                        <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-muted-foreground mt-1 shrink-0" /><p className="text-sm whitespace-pre-wrap">{card.address || 'N/A'}</p></div>
                        {(card.linkedIn || card.twitter) && <Separator />}
                        <div className="space-y-2">
                            {card.linkedIn && <div className="flex items-center gap-3 text-sm"><Linkedin className="h-4 w-4 text-muted-foreground" /> <a href={card.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a> <span className="text-xs text-muted-foreground">({card.linkedIn})</span></div>}
                            {card.twitter && <div className="flex items-center gap-3 text-sm"><Twitter className="h-4 w-4 text-muted-foreground" /> <a href={card.twitter} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Twitter/X</a> <span className="text-xs text-muted-foreground">({card.twitter})</span></div>}
                        </div>
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
        </div>
        <div className="lg:col-span-1 space-y-4">
            <Card>
                <CardHeader><CardTitle>Sharing Options</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <Button onClick={handleDownloadQr} variant="secondary" className="w-full"><Download className="mr-2 h-4 w-4"/> Download QR Only</Button>
                    <Button onClick={copyPublicLink} variant="outline" className="w-full"><Copy className="mr-2 h-4 w-4"/> Copy Public Link</Button>
                    <Button onClick={handleDownloadCard} variant="default" className="w-full" disabled={isDownloading}>
                        {isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating...</> : <><DownloadCloud className="mr-2 h-4 w-4"/>Download Full Card</>}
                    </Button>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'link' }), "w-full")}>
                        <Eye className="mr-2 h-4 w-4"/> View Public Card
                    </a>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
