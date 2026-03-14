
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, FileSignature, Edit, Trash2, Download } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { Letter } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { useLoading } from '@/contexts/loading-context';
import { Loader2 } from 'lucide-react';
import LettersLoading from '@/app/dashboard/letter-generation/loading';
import LetterPrintModal from './letter-print-modal';

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy, p'); }
  catch (e) { return dateString; }
};

export default function LettersClientPage() {
  const { user, dataOwnerId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedLetterForPrint, setSelectedLetterForPrint] = useState<Letter | null>(null);


  const fetchLetters = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/letters?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error('Failed to fetch letters.');
      setLetters(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: `Could not load letters: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchLetters();
    }
  }, [authLoading, fetchLetters]);

  const handleDelete = async (letterId: string, letterTitle: string) => {
    setIsDeleting(true); setCurrentDeletingId(letterId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/letters/${letterId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete letter.');
      toast({ title: "Success", description: `"${letterTitle}" deleted.` });
      setLetters(prev => prev.filter(l => l.id !== letterId));
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete letter: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };

  const handleOpenPrintModal = (letter: Letter) => {
    setSelectedLetterForPrint(letter);
    setIsPrintModalOpen(true);
  };

  if (isLoading || authLoading) return <LettersLoading />;

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <FileSignature className="mr-3 h-7 w-7 text-primary" /> Generated Letters & Certificates
          </h1>
          <p className="text-muted-foreground">Manage all your AI-generated documents.</p>
        </div>
        <Button asChild onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/letter-generation/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader><CardTitle>Your Documents</CardTitle></CardHeader>
        <CardContent>
          {letters.length === 0 ? (
            <div className="text-center py-12"><p className="text-muted-foreground">No documents generated yet.</p></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {letters.map(letter => (
                <Card key={letter.id} className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-2">{letter.generatedTitle || letter.subject}</CardTitle>
                    <CardDescription>To: {letter.recipient}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-xs text-muted-foreground">Last updated: {formatDate(letter.updatedAt)}</p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-1">
                     <Button variant="ghost" size="sm" asChild onClick={() => setGlobalIsLoading(true)}>
                        <Link href={`/dashboard/letter-generation/${letter.id}`}>
                            <Edit className="mr-1 h-3 w-3" /> View/Edit
                        </Link>
                     </Button>
                     <Button variant="secondary" size="sm" onClick={() => handleOpenPrintModal(letter)}>
                        <Download className="mr-1 h-3 w-3" /> Download
                     </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeleting && currentDeletingId === letter.id}>
                                {isDeleting && currentDeletingId === letter.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete this document.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(letter.id!, letter.generatedTitle || 'this document')} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    {selectedLetterForPrint && (
        <LetterPrintModal
          isOpen={isPrintModalOpen}
          onOpenChange={setIsPrintModalOpen}
          letter={selectedLetterForPrint}
        />
    )}
    </>
  );
}
