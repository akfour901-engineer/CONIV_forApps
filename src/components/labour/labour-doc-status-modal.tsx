
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { FileWarning, X, Search, ArrowDownUp, Loader2 } from "lucide-react";
import type { LabourRegister } from '@/types';
import { formatDate, isExpiringSoon } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useLoading } from '@/contexts/loading-context';
import { useRouter } from 'next/navigation';

interface LabourDocStatusModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  labourers: LabourRegister[];
}

interface DocumentIssue {
  labourerId: string;
  workerName: string;
  role: string;
  docType: string;
  expiryDate: string | null;
  status: 'Expiring Soon' | 'Missing Information';
}


export function LabourDocStatusModal({ isOpen, onOpenChange, labourers }: LabourDocStatusModalProps) {
  const { setIsLoading } = useLoading();
  const router = useRouter();

  const documentIssues = useMemo(() => {
    if (!labourers) return [];
    const issues: DocumentIssue[] = [];
    
    labourers.forEach(labourer => {
      // Check for expiring documents
      if (isExpiringSoon(labourer.medicalCertificateExpiry)) {
        issues.push({ labourerId: labourer.id!, workerName: labourer.workerName, role: labourer.role, docType: 'Medical Certificate', expiryDate: labourer.medicalCertificateExpiry!, status: 'Expiring Soon' });
      }
      if (isExpiringSoon(labourer.nocExpiry)) {
        issues.push({ labourerId: labourer.id!, workerName: labourer.workerName, role: labourer.role, docType: 'NOC', expiryDate: labourer.nocExpiry!, status: 'Expiring Soon' });
      }
      if (isExpiringSoon(labourer.gatePassExpiry)) {
        issues.push({ labourerId: labourer.id!, workerName: labourer.workerName, role: labourer.role, docType: 'Gate Pass', expiryDate: labourer.gatePassExpiry!, status: 'Expiring Soon' });
      }
      
      // Check for missing documents
      if (!labourer.medicalCertificateNumber) {
        issues.push({ labourerId: labourer.id!, workerName: labourer.workerName, role: labourer.role, docType: 'Medical Certificate', expiryDate: null, status: 'Missing Information' });
      }
      if (!labourer.nocNumber) {
        issues.push({ labourerId: labourer.id!, workerName: labourer.workerName, role: labourer.role, docType: 'NOC', expiryDate: null, status: 'Missing Information' });
      }
      if (!labourer.identityProofNumber) {
        issues.push({ labourerId: labourer.id!, workerName: labourer.workerName, role: labourer.role, docType: 'Identity Proof', expiryDate: null, status: 'Missing Information' });
      }
      if (!labourer.gatePassNumber) {
        issues.push({ labourerId: labourer.id!, workerName: labourer.workerName, role: labourer.role, docType: 'Gate Pass', expiryDate: null, status: 'Missing Information' });
      }
    });
    
    // Remove duplicates: if a doc is expiring, don't also show it as missing.
    const uniqueIssues = Array.from(new Map(issues.map(item => [`${item.labourerId}-${item.docType}`, item])).values());

    return uniqueIssues.sort((a, b) => {
      if (a.expiryDate && b.expiryDate) {
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return a.workerName.localeCompare(b.workerName);
    });
  }, [labourers]);
  
  const handleUpdateClick = (labourerId: string) => {
    setIsLoading(true);
    onOpenChange(false);
    router.push(`/dashboard/labour-register/${labourerId}/edit`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-full flex flex-col p-0 print:p-0">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center">
            <FileWarning className="mr-2 h-5 w-5 text-orange-500" /> Labour Document Status
          </DialogTitle>
          <DialogDescription>
            A list of all labourer documents that are missing or expiring within the next 90 days.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {documentIssues.length === 0 ? (
            <div className="text-center py-16">
                <FileWarning className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">All Clear!</p>
                <p className="text-sm text-muted-foreground">No documents are missing or expiring soon.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Labourer</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Expiry Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentIssues.map((doc, index) => (
                    <TableRow key={`${doc.labourerId}-${index}`}>
                      <TableCell className="font-medium">{doc.workerName}</TableCell>
                      <TableCell>{doc.docType}</TableCell>
                      <TableCell>
                        <Badge variant={doc.status === 'Expiring Soon' ? 'destructive' : 'outline'}>{doc.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{doc.expiryDate ? formatDate(doc.expiryDate) : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleUpdateClick(doc.labourerId)}>
                              Update
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="secondary"><X className="mr-2 h-4 w-4" /> Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
