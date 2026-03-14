
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
import { formatCurrency, formatDate, isBefore, addMonths } from '@/lib/utils';
import { X, PieChart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';

interface ComprehensiveSdAnalyzerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrders: WorkOrder[];
}

interface AnalyzedSdItem {
    workOrderId: string;
    workOrderNumber: string;
    organizationName: string;
    projectValue: number;
    sdAmount: number;
    projectEndDate: string;
    depositPeriod: number;
    sdReturnDate: Date | null;
    status: 'Due for Return' | 'Pending Return' | 'In Progress';
}

export function ComprehensiveSdAnalyzerModal({ isOpen, onOpenChange, workOrders }: ComprehensiveSdAnalyzerModalProps) {
    const today = new Date();

    const analyzedData = useMemo(() => {
        return workOrders
            .filter(wo => wo.securityDeposit && wo.securityDeposit > 0)
            .map(wo => {
                const sdReturnDate = wo.endDate && wo.depositPeriod ? addMonths(new Date(wo.endDate), wo.depositPeriod) : null;
                let status: AnalyzedSdItem['status'] = 'In Progress';
                if (wo.status === 'completed') {
                    if (sdReturnDate && isBefore(sdReturnDate, today)) {
                        status = 'Due for Return';
                    } else {
                        status = 'Pending Return';
                    }
                }
                return {
                    workOrderId: wo.id!,
                    workOrderNumber: wo.workOrderNumber,
                    organizationName: wo.organizationName,
                    projectValue: wo.grandTotal,
                    sdAmount: wo.securityDeposit ?? 0,
                    projectEndDate: wo.endDate,
                    depositPeriod: wo.depositPeriod || 0,
                    sdReturnDate,
                    status,
                };
            })
            .sort((a, b) => {
                if (a.sdReturnDate && b.sdReturnDate) return a.sdReturnDate.getTime() - b.sdReturnDate.getTime();
                if (a.sdReturnDate) return -1;
                if (b.sdReturnDate) return 1;
                return new Date(a.projectEndDate).getTime() - new Date(b.projectEndDate).getTime();
            });
    }, [workOrders, today]);

    const totalSdHeld = analyzedData.reduce((sum, item) => sum + (item.sdAmount ?? 0), 0);
    const totalSdDue = analyzedData.filter(item => item.status === 'Due for Return').reduce((sum, item) => sum + (item.sdAmount ?? 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center"><PieChart className="mr-2 h-5 w-5 text-primary"/>Comprehensive Security Deposit Analysis</DialogTitle>
          <DialogDescription>
            An overview of all security deposits held across your projects.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
            <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 border rounded-lg">
                        <div className="text-xs text-muted-foreground">Total SD Held</div>
                        <div className="text-lg font-bold">{formatCurrency(totalSdHeld)}</div>
                    </div>
                     <div className="p-3 border rounded-lg border-amber-500/50 bg-amber-500/5">
                        <div className="text-xs text-amber-700">Total SD Due for Return</div>
                        <div className="text-lg font-bold text-amber-800">{formatCurrency(totalSdDue)}</div>
                    </div>
                </div>
                {analyzedData.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No work orders with security deposits found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>WO #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead className="text-right">SD Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Est. Return Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analyzedData.map(item => (
                                    <TableRow key={item.workOrderId}>
                                        <TableCell><Link href={`/dashboard/work-orders/${item.workOrderId}`} className="text-primary hover:underline">{item.workOrderNumber}</Link></TableCell>
                                        <TableCell>{item.organizationName}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.sdAmount)}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === 'Due for Return' ? 'destructive' : item.status === 'Pending Return' ? 'default' : 'secondary'}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{item.sdReturnDate ? formatDate(item.sdReturnDate.toISOString()) : 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
        <DialogFooter className="p-6 pt-4 border-t shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}><X className="mr-2 h-4 w-4" /> Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
