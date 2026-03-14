
'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, QrCode, Eye, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, Copy, Settings2 } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import type { DigitalBusinessCard } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import QrBusinessCardListLoading from '@/app/dashboard/advance-tools/qr-business-card/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const QrBusinessCard = React.memo(({ card, onDelete, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: { card: DigitalBusinessCard, onDelete: (cardId: string, cardName: string) => void, isDeleting: boolean, currentDeletingId: string | null, canManage: boolean, setGlobalIsLoading: (loading: boolean) => void }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg line-clamp-2">{card.cardName}</CardTitle>
        </div>
        <CardDescription className="text-sm">{card.fullName}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1 flex-grow">
        <p><span className="font-medium">Title:</span> {card.title || 'N/A'}</p>
        <p><span className="font-medium">Company:</span> {card.companyName || 'N/A'}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                    Actions <Settings2 className="ml-2 h-4 w-4"/>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild onClick={() => setGlobalIsLoading(true)}>
                    <Link href={`/dashboard/advance-tools/qr-business-card/${card.id}`}>
                        <Eye className="mr-2 h-4 w-4"/>View
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!canManage} onClick={() => setGlobalIsLoading(true)}>
                    <Link href={`/dashboard/advance-tools/qr-business-card/${card.id}/edit`}>
                       <Edit className="mr-2 h-4 w-4"/>Edit
                    </Link>
                </DropdownMenuItem>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canManage} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4"/>Delete
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete the card: {card.cardName}.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(card.id!, card.cardName)} className="bg-destructive hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
});
QrBusinessCard.displayName = 'QrBusinessCard';

export default function QrBusinessCardListPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
    const { toast } = useToast();
    const [cards, setCards] = useState<DigitalBusinessCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
    const { setIsLoading: setGlobalIsLoading } = useLoading();
  
    const [searchTerm, setSearchTerm] = useState('');

    const canManageCards = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDigitalBusinessCards;

    const fetchCards = useCallback(async () => {
      if (!user || !dataOwnerId) { setIsLoading(false); return; }
      if (!canManageCards) { setIsLoading(false); toast({ title: "Permission Denied", variant: "destructive" }); return; }

      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/digital-business-cards?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch cards.');
        setCards(await response.json());
      } catch (error: any) {
        toast({ title: "Error", description: `Could not load cards: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }, [user, dataOwnerId, canManageCards, toast]);

    useEffect(() => {
        if (!authLoading) {
            fetchCards();
        }
    }, [authLoading, fetchCards]);

    const handleDelete = async (cardId: string, cardName: string) => {
        if (!canManageCards) return;
        setIsDeleting(true); setCurrentDeletingId(cardId);
        try {
            const idToken = await user!.getIdToken();
            const response = await fetch(`/api/digital-business-cards/${cardId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete card.');
            toast({ title: "Success", description: `${cardName} deleted.` });
            setCards(prev => prev.filter(c => c.id !== cardId));
        } catch (error: any) {
            toast({ title: "Error", description: `Could not delete card: ${error.message}`, variant: "destructive" });
        } finally {
            setIsDeleting(false); setCurrentDeletingId(null);
        }
    };
    
    const filteredCards = useMemo(() => cards.filter(c =>
        c.cardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [cards, searchTerm]);

    if (isLoading || authLoading) return <QrBusinessCardListLoading />;
    if (!canManageCards && !isLoading) {
         return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to manage Digital Business Cards.</p>
                <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
                <Link href="/dashboard/advance-tools">Back to Advance Tools</Link>
                </Button>
            </div>
        );
    }
  
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-semibold flex items-center"><QrCode className="mr-3 h-7 w-7 text-primary" /> Digital Business Cards</h1>
                <p className="text-muted-foreground">Create and manage your shareable digital contact cards.</p>
            </div>
            <Button asChild disabled={!canManageCards} onClick={() => setGlobalIsLoading(true)}>
                <Link href="/dashboard/advance-tools/qr-business-card/new"><PlusCircle className="mr-2 h-5 w-5" /> Create New Card</Link>
            </Button>
        </div>
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Your Cards</CardTitle>
                <div className="pt-2">
                    <Input placeholder="Search by Card Name, Full Name, Company..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
                </div>
            </CardHeader>
            <CardContent>
                {filteredCards.length === 0 ? (
                    <div className="text-center py-12"><QrCode className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-4 text-lg font-medium">{searchTerm ? "No cards match your search." : "No cards created yet."}</p></div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredCards.map(card => <QrBusinessCard key={card.id} card={card} onDelete={handleDelete} isDeleting={isDeleting} currentDeletingId={currentDeletingId} canManage={canManageCards} setGlobalIsLoading={setGlobalIsLoading} />)}
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    );
}

