
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, Document as AppDocument } from '@/types';
import { Loader2, X, FileArchive, DownloadCloud, ExternalLink, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ViewWorkOrderDocumentsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
}

export default function ViewWorkOrderDocumentsModal({
  isOpen,
  onOpenChange,
  workOrder,
}: ViewWorkOrderDocumentsModalProps) {
  const { user, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && workOrder && user && dataOwnerId) {
      const fetchDocuments = async () => {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          // Assuming an API endpoint exists to fetch documents for a specific WO
          const response = await fetch(`/api/documents?dataOwnerId=${dataOwnerId}&workOrderId=${workOrder.id}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch documents for this work order.');
          }
          const data: AppDocument[] = await response.json();
          setDocuments(data);
        } catch (error: any) {
          console.error("Error fetching documents for modal:", error);
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [isOpen, workOrder, user, dataOwnerId, toast]);
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'dd MMM yyyy'); }
    catch (e) {
      try { return format(new Date(dateString), 'dd MMM yyyy'); }
      catch (parseErr) { return dateString; }
    }
  };

  if (!workOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center"><FileArchive className="mr-2 h-5 w-5"/>Documents for WO: {workOrder.workOrderNumber}</DialogTitle>
          <DialogDescription>
            View all documents linked to this work order. You can add more from the main Documents page.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-8">No documents are currently linked to this work order.</p>
          ) : (
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded On</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium truncate max-w-[200px]" title={doc.documentName}>{doc.documentName}</TableCell>
                      <TableCell>{doc.documentType}</TableCell>
                      <TableCell>{formatDate(doc.dateUploaded)}</TableCell>
                      <TableCell className="text-right">
                         <a href={doc.documentUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                           {doc.documentUrl?.startsWith('data:') ? <DownloadCloud className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                           View
                         </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </div>
        <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
          <Button type="button" variant="outline" asChild>
            <Link href={`/dashboard/documents/new?workOrderId=${workOrder.id}`}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Document
            </Link>
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary"><X className="mr-2 h-4 w-4" /> Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
