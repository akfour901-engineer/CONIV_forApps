
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Mail, Trash2, Search, AlertTriangle, Loader2, Edit, Settings2, Sparkles, FileText, ArrowDownUp } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { MailingListContent } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import MailingListLoading from '@/app/dashboard/marketing/content/loading';
import { useLoading } from '@/contexts/loading-context';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { DataTablePagination } from '../ui/data-table-pagination';

const ContentCard = React.memo(
  ({
    content,
    onDelete,
    isDeleting,
    currentDeletingId,
    setGlobalIsLoading,
  }: {
    content: MailingListContent;
    onDelete: (id: string) => void;
    isDeleting: boolean;
    currentDeletingId: string | null;
    setGlobalIsLoading: (loading: boolean) => void;
  }) => (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="truncate" title={content.contentName}>
          {content.contentName}
        </CardTitle>
        <CardDescription
          className="line-clamp-2 break-words text-sm"
          title={content.subject}
        >
          Subject: {content.subject}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-xs text-muted-foreground">
          Created: {format(parseISO(content.createdAt), 'dd MMM yyyy')}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2 pt-1">
        <Button
          asChild
          variant="outline"
          size="sm"
          onClick={() => setGlobalIsLoading(true)}
        >
          <Link href={`/dashboard/marketing/content/${content.id}`}>
            <Edit className="h-4 w-4 mr-1.5" />
            Edit
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting && currentDeletingId === content.id}
            >
              {isDeleting && currentDeletingId === content.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{content.contentName}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(content.id!)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
);
ContentCard.displayName = 'ContentCard';

export default function MarketingContentClientPage() {
  const { user, loading: authLoading, dataOwnerId, currentTeamMemberPermissions, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [contents, setContents] = useState<MailingListContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canManageMailingList = useMemo(
    () => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageMailingList,
    [isViewingOwnAccount, currentTeamMemberPermissions]
  );

  const fetchContent = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageMailingList) {
      if (!authLoading && !canManageMailingList) {
        toast({ title: "Permission Denied", variant: "destructive" });
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/marketing/content?dataOwnerId=${dataOwnerId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (response.ok) setContents(await response.json());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, canManageMailingList, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchContent();
    }
  }, [authLoading, dataOwnerId, fetchContent]);

  const handleDelete = async (contentId: string) => {
    if (!user) return;
    setIsDeleting(true);
    setCurrentDeletingId(contentId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/marketing/content/${contentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error("Failed to delete content.");
      toast({ title: "Content Deleted" });
      fetchContent();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setCurrentDeletingId(null);
    }
  };

  const filteredContent = useMemo(() => {
    return contents.filter(
      (c) =>
        c.contentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contents, searchTerm]);

  const totalPages = Math.ceil(filteredContent.length / itemsPerPage);
  const paginatedContent = filteredContent.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (authLoading || isLoading) return <MailingListLoading />;

  if (!canManageMailingList) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">
          You do not have permission to manage marketing content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <FileText className="h-7 w-7 text-primary" />
            Marketing Content
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI-generated email content.
          </p>
        </div>
        <Button asChild onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/marketing/content-generator">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Content
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Content</CardTitle>
          <Input
            placeholder="Search content by name or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm mt-2"
          />
        </CardHeader>

        <CardContent>
          {/* Mobile / small screen view */}
          <div className="grid md:hidden gap-4">
            {paginatedContent.length > 0 ? (
              paginatedContent.map((content) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                  currentDeletingId={currentDeletingId}
                  setGlobalIsLoading={setGlobalIsLoading}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No content saved yet.</p>
              </div>
            )}
          </div>

          {/* Desktop/table view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContent.length > 0 ? (
                  paginatedContent.map((content) => (
                    <TableRow key={content.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={content.contentName}>
                        {content.contentName}
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={content.subject}>
                        {content.subject}
                      </TableCell>
                      <TableCell>{format(parseISO(content.createdAt), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          onClick={() => setGlobalIsLoading(true)}
                        >
                          <Link href={`/dashboard/marketing/content/${content.id}`}>
                            <Edit className="h-4 w-4 mr-1.5" />
                            Edit
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting && currentDeletingId === content.id}
                            >
                              {isDeleting && currentDeletingId === content.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete <strong>{content.contentName}</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(content.id!)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      No content saved yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {filteredContent.length > 0 && (
          <CardFooter>
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              canPreviousPage={currentPage > 1}
              canNextPage={currentPage < totalPages}
              itemCount={contents.length}
              filteredItemCount={filteredContent.length}
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
