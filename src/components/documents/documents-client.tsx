
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, FileArchive, Eye, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, ExternalLink, DownloadCloud } from "lucide-react";
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import type { Document as AppDocument } from '@/types';
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
import { format, parseISO } from 'date-fns';
import DocumentsLoading from '@/app/dashboard/documents/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Loader2 } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { WorkOrder } from '@/types';


const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy'); }
  catch (e) {
    try { return format(new Date(dateString), 'dd MMM yyyy'); }
    catch (parseErr) { return dateString; }
  }
};

interface DocumentCardProps {
  document: AppDocument;
  onDelete: (docId: string, docName: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const DocumentCard = React.memo(({ document, onDelete, isDeleting, currentDeletingId, canManage, setGlobalIsLoading }: DocumentCardProps) => (
  <Card key={document.id} className="shadow-sm">
    <CardHeader className="pb-2">
      <CardTitle className="text-md line-clamp-2">{document.documentName}</CardTitle>
      <CardDescription className="text-xs">{document.documentType}</CardDescription>
    </CardHeader>
    <CardContent className="text-xs space-y-0.5 pt-1 pb-2">
      {document.workOrderNumber && <p><span className="font-medium">WO#:</span> {document.workOrderNumber}</p>}
      <p><span className="font-medium">Uploaded:</span> {formatDate(document.dateUploaded)}</p>
    </CardContent>
    <CardFooter className="flex justify-end gap-1 pt-2 pb-3 border-t">
       <a
        href={document.documentUrl!}
        target="_blank"
        rel="noopener noreferrer"
        download={document.documentName}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
        title="View/Download Document"
      >
        {document.documentUrl?.startsWith('data:') ? <DownloadCloud className="mr-1 h-3 w-3" /> : <ExternalLink className="mr-1 h-3 w-3" />}
        View
      </a>
      <Button variant="outline" size="sm" className="text-xs" asChild disabled={!canManage} onClick={() => setGlobalIsLoading(true)}>
        <Link href={`/dashboard/documents/${document.id}/edit`}>
          <Edit className="mr-1 h-3 w-3" />Edit
        </Link>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
           <Button variant="destructive" size="sm" className="text-xs" disabled={!canManage || (isDeleting && currentDeletingId === document.id)}>
              {isDeleting && currentDeletingId === document.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash2 className="h-3 w-3"/>}
           </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete the document: {document.documentName}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(document.id!, document.documentName)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardFooter>
  </Card>
));
DocumentCard.displayName = 'DocumentCard';


export default function DocumentsClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [filterWorkOrderId, setFilterWorkOrderId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AppDocument; direction: 'asc' | 'desc' } | null>({ key: 'dateUploaded', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const canManageDocuments = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDocuments, [isViewingOwnAccount, currentTeamMemberPermissions]);

  const fetchDocumentsAndWos = useCallback(async () => {
    if (!user || !dataOwnerId) { setIsLoading(false); return; }
    if (!canManageDocuments) {
        setIsLoading(false);
        setDocuments([]);
        toast({ title: "Permission Denied", description: "You do not have permission to view documents.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const [docResponse, woResponse] = await Promise.all([
        fetch(`/api/documents?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      ]);
      
      if (!docResponse.ok) throw new Error((await docResponse.json()).error || 'Failed to fetch documents.');
      setDocuments(await docResponse.json());
      
      if (woResponse.ok) {
        const woData: WorkOrder[] = await woResponse.json();
        setWorkOrders(woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));
      }

    } catch (error: any) {
      toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, canManageDocuments, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchDocumentsAndWos();
    }
  }, [authLoading, fetchDocumentsAndWos, dataOwnerId]);

  const handleDelete = async (docId: string, docName: string) => {
    if (!canManageDocuments) return;
    setIsDeleting(true); setCurrentDeletingId(docId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete document.');
      toast({ title: "Success", description: `${docName} deleted.` });
      setDocuments(prev => prev.filter(doc => doc.id !== docId));
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete document: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false); setCurrentDeletingId(null);
    }
  };

  const sortedAndFilteredDocuments = useMemo(() => {
    return documents
      .filter(doc => filterWorkOrderId === 'all' || doc.workOrderId === filterWorkOrderId)
      .filter(doc => 
        doc.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.documentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.workOrderNumber && doc.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const aVal = a[sortConfig.key]; 
        const bVal = b[sortConfig.key];
        if (aVal === null || aVal === undefined) return 1; 
        if (bVal === null || bVal === undefined) return -1;
        if (sortConfig.key === 'dateUploaded') {
            return (new Date(aVal as string).getTime() - new Date(bVal as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
  }, [documents, searchTerm, sortConfig, filterWorkOrderId]);
  
  const totalPages = Math.ceil(sortedAndFilteredDocuments.length / itemsPerPage);
  const paginatedDocuments = sortedAndFilteredDocuments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) return <DocumentsLoading />;
  if (!canManageDocuments && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage documents.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold flex items-center"><FileArchive className="mr-3 h-7 w-7 text-primary" /> Documents</h1><p className="text-muted-foreground">Upload and manage all your project-related documents.</p></div>
        <Button asChild disabled={!canManageDocuments} onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/documents/new"><PlusCircle className="mr-2 h-5 w-5" /> Add New Document</Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>Your Documents</CardTitle>
            <div className="pt-2 flex flex-col md:flex-row gap-2">
                <Input placeholder="Search by Name, Type, WO#..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
                <Combobox options={[{ value: 'all', label: 'All Work Orders' }, ...workOrders]} value={filterWorkOrderId} onChange={(val) => setFilterWorkOrderId(val)} placeholder="Filter by Work Order..." className="w-full md:w-[250px]" disabled={isLoading} />
            </div>
        </CardHeader>
        <CardContent>
          <div className="md:hidden grid gap-4 sm:grid-cols-2">
            {paginatedDocuments.length > 0 ? paginatedDocuments.map(doc => <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} isDeleting={isDeleting} currentDeletingId={currentDeletingId} canManage={canManageDocuments} setGlobalIsLoading={setGlobalIsLoading} />) : <p className="text-muted-foreground text-center py-8 col-span-full">No documents found.</p>}
          </div>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Linked To</TableHead><TableHead>Uploaded On</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginatedDocuments.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center h-24">No documents found.</TableCell></TableRow>) : paginatedDocuments.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium truncate max-w-xs">{doc.documentName}</TableCell><TableCell>{doc.documentType}</TableCell><TableCell>{doc.workOrderNumber || 'N/A'}</TableCell><TableCell>{formatDate(doc.dateUploaded)}</TableCell>
                      <TableCell className="text-right">
                        <a href={doc.documentUrl!} target="_blank" rel="noopener noreferrer" download={doc.documentName} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                            {doc.documentUrl?.startsWith('data:') ? <DownloadCloud className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />} View
                        </a>
                        <Button asChild variant="ghost" size="sm" disabled={!canManageDocuments} onClick={() => setGlobalIsLoading(true)}><Link href={`/dashboard/documents/${doc.id}/edit`}><Edit className="mr-2 h-4 w-4"/>Edit</Link></Button>
                        <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={!canManageDocuments || (isDeleting && currentDeletingId === doc.id)}>{isDeleting && currentDeletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete {doc.documentName}.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(doc.id!, doc.documentName)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>{isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
         {sortedAndFilteredDocuments.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-2">
            <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={documents.length} filteredItemCount={sortedAndFilteredDocuments.length}/>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
