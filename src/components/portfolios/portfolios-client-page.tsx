
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Workflow, Eye, Edit, Trash2, Copy, Link as LinkIcon, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { Portfolio, PortfolioContact } from '@/types';
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
import { useLoading } from '@/contexts/loading-context';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import ViewContactRequestModal from './view-contact-request-modal'; // Import the new modal
import { format } from 'date-fns';

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try { return format(new Date(dateString), 'dd MMM yyyy, p'); }
  catch (e) { return 'Invalid Date'; }
};

export default function PortfoliosClientPage() {
  const { user, dataOwnerId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [contacts, setContacts] = useState<PortfolioContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<PortfolioContact | null>(null);
  
  const canManage = !!user; // For now, only owners can manage.

  const fetchPortfoliosAndContacts = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const [portfoliosResponse, contactsResponse] = await Promise.all([
        fetch(`/api/portfolios?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        }),
        fetch(`/api/portfolio-contact?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
      ]);
      
      if (!portfoliosResponse.ok) throw new Error('Failed to fetch portfolios.');
      setPortfolios(await portfoliosResponse.json());

      if (contactsResponse.ok) {
        setContacts(await contactsResponse.json());
      } else {
        console.warn("Could not fetch portfolio contacts.");
      }

    } catch (error: any) {
      toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (!authLoading) fetchPortfoliosAndContacts();
  }, [authLoading, fetchPortfoliosAndContacts]);

  const handleDelete = async (portfolioId: string, portfolioName: string) => {
    if (!canManage) return;
    setIsDeleting(true); setCurrentDeletingId(portfolioId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/portfolios/${portfolioId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete portfolio.');
      toast({ title: "Success", description: `${portfolioName} deleted.` });
      setPortfolios(prev => prev.filter(p => p.id !== portfolioId));
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete portfolio: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };

  const copyPublicLink = (publicId: string) => {
    const link = `${window.location.origin}/p/${publicId}`;
    navigator.clipboard.writeText(link)
      .then(() => toast({ title: "Link Copied", description: "Public portfolio link copied to clipboard." }))
      .catch(() => toast({ title: "Copy Failed", variant: "destructive" }));
  };

  const handleContactClick = (contact: PortfolioContact) => {
    setSelectedContact(contact);
    setIsContactModalOpen(true);
  };

  const contactsByPortfolio = useMemo(() => {
    return contacts.reduce((acc, contact) => {
      if (!acc[contact.portfolioId]) {
        acc[contact.portfolioId] = [];
      }
      acc[contact.portfolioId].push(contact);
      return acc;
    }, {} as Record<string, PortfolioContact[]>);
  }, [contacts]);

  if (isLoading || authLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
    <ViewContactRequestModal
      isOpen={isContactModalOpen}
      onOpenChange={setIsContactModalOpen}
      contact={selectedContact}
    />
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Workflow className="mr-3 h-7 w-7 text-primary" /> My Portfolios
          </h1>
          <p className="text-muted-foreground">Manage your AI-generated public portfolios.</p>
        </div>
        <Button asChild disabled={!canManage} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/advance-tools/ai-portfolio-generator">
            <PlusCircle className="mr-2 h-5 w-5" /> Generate New Portfolio
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader><CardTitle>Generated Portfolios</CardTitle></CardHeader>
        <CardContent>
          {portfolios.length === 0 ? (
            <div className="text-center py-12"><p className="text-muted-foreground">No portfolios generated yet.</p></div>
          ) : (
            <div className="space-y-6">
              {portfolios.map(p => (
                <Card key={p.id} className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="truncate">{p.portfolioName}</CardTitle>
                    <CardDescription>Path: /p/{p.publicId}</CardDescription>
                  </CardHeader>
                   <CardContent>
                      <h4 className="font-semibold text-sm mb-2">Contact Requests ({contactsByPortfolio[p.id!]?.length || 0})</h4>
                      {contactsByPortfolio[p.id!] && contactsByPortfolio[p.id!].length > 0 ? (
                        <div className="border rounded-md max-h-60 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>From</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Message</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contactsByPortfolio[p.id!].map(contact => (
                                    <TableRow key={contact.id} onClick={() => handleContactClick(contact)} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell className="text-xs whitespace-nowrap">{formatDate(contact.createdAt)}</TableCell>
                                        <TableCell className="font-medium text-xs">{contact.name}</TableCell>
                                        <TableCell className="text-xs">{contact.email}{contact.phone && `, ${contact.phone}`}</TableCell>
                                        <TableCell className="text-xs max-w-xs truncate" title={contact.message}>{contact.message}</TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                      ) : <p className="text-xs text-muted-foreground">No new contact requests.</p>}
                   </CardContent>
                  <CardFooter className="flex justify-end gap-1 border-t pt-4 bg-secondary/30 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => copyPublicLink(p.publicId)}><Copy className="mr-1 h-3 w-3"/>Link</Button>
                    <a href={`/p/${p.publicId}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}><Eye className="mr-1 h-3 w-3"/>Preview</a>
                    <Button variant="outline" size="sm" asChild onClick={() => setGlobalIsLoading(true)}>
                        <Link href={`/dashboard/portfolios/${p.id}/edit`}>
                            <Edit className="mr-1 h-3 w-3" /> Edit
                        </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeleting}>
                            {isDeleting && currentDeletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Portfolio?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the portfolio `{p.portfolioName}`. This action is irreversible.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id!, p.portfolioName)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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
    </>
  );
}
