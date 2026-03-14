
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WorkOrder } from '@/types';
import { formatCurrency, formatDate, isBefore } from '@/lib/utils';
import { X, PieChart } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { addMonths } from "date-fns";


interface WorkOrderSdAnalyzerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
}

export function WorkOrderSdAnalyzerModal({ isOpen, onOpenChange, workOrder }: WorkOrderSdAnalyzerModalProps) {
    if (!workOrder) return null;
    
    const sdAmount = workOrder.securityDeposit;
    const sdPeriod = workOrder.depositPeriod;
    const projectEndDate = workOrder.endDate;
    
    const sdReturnDate = sdAmount && sdPeriod && projectEndDate ? addMonths(new Date(projectEndDate), sdPeriod) : null;
    
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center"><PieChart className="mr-2 h-5 w-5 text-primary"/>Security Deposit Analyzer</DialogTitle>
          <DialogDescription>
            Details for Work Order #{workOrder.workOrderNumber}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            {sdAmount && sdAmount > 0 ? (
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-lg font-semibold">
                        <span>Total SD Amount:</span>
                        <span className="text-primary">{formatCurrency(sdAmount)}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                        <span>Deposit Period:</span>
                        <span className="font-medium">{sdPeriod || 'N/A'} months</span>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                        <span>Project End Date:</span>
                        <span className="font-medium">{formatDate(projectEndDate)}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t">
                        <span className="font-semibold">Est. SD Return Date:</span>
                        <span className="font-bold text-green-600">{sdReturnDate ? formatDate(sdReturnDate.toISOString()) : 'N/A'}</span>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">No Security Deposit information is recorded for this work order.</p>
                </div>
            )}
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}><X className="mr-2 h-4 w-4" /> Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
