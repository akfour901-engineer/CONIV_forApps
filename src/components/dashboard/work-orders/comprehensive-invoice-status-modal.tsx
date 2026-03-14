
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
import type { WorkOrder, Invoice, OtherDeduction } from '@/types';
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { X, Receipt, ArrowUpRight, ArrowDownRight, DollarSign, Banknote } from "lucide-react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";

interface WorkOrderInvoiceStatusModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  invoices: Invoice[];
}

interface AnalyzedInvoiceItem {
    workOrderId: string;
    workOrderNumber: string;
    organizationName: string;
    projectValue: number;
    totalInvoiced: number;
    totalPaid: number;
    totalDeductions: number;
    netReceivable: number;
    status: 'Paid in Full' | 'Overpaid' | 'Partially Paid' | 'Invoiced, Unpaid' | 'Partially Invoiced' | 'Uninvoiced';
}

const statusColors: Record<string, string> = {
    'Paid in Full': 'bg-green-100 text-green-800',
    'Overpaid': 'bg-blue-100 text-blue-800',
    'Partially Paid': 'bg-purple-100 text-purple-800',
    'Invoiced, Unpaid': 'bg-yellow-100 text-yellow-800',
    'Partially Invoiced': 'bg-orange-100 text-orange-800',
    'Uninvoiced': 'bg-gray-100 text-gray-800',
};


const ProfitLossIndicator = ({ value }: { value: number }) => {
    const isProfit = value >= 0;
    const isLoss = value < 0;
    return (
      <div className={cn("flex items-center font-semibold text-xs", isProfit && "text-green-600", isLoss && "text-destructive")}>
        {value !== 0 && (isProfit ? <ArrowUpRight className="mr-1 h-3 w-3 shrink-0" /> : <ArrowDownRight className="mr-1 h-3 w-3 shrink-0" />)}
        <span className="truncate">{formatCurrency(value)}</span>
      </div>
    );
};

export function ComprehensiveInvoiceStatusModal({ isOpen, onOpenChange, workOrders, allInvoices }: { isOpen: boolean, onOpenChange: (open: boolean) => void, workOrders: WorkOrder[], allInvoices: Invoice[] }) {
    
    const analyzedData: AnalyzedInvoiceItem[] = useMemo(() => {
        return workOrders.map(wo => {
            const linkedInvoices = allInvoices.filter(inv => inv.workOrderId === wo.id);
            const totalInvoiced = linkedInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
            const totalPaid = linkedInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
            const totalDeductions = linkedInvoices.reduce((sum, inv) => {
                const otherDeductionsTotal = (inv.otherDeductions || []).reduce((s, d) => s + d.amount, 0);
                return sum + (inv.sdDeducted || 0) + (inv.tdsDeducted || 0) + (inv.ldDeducted || 0) + otherDeductionsTotal;
            }, 0);

            const netReceivable = totalInvoiced - totalPaid - totalDeductions;

            let status: AnalyzedInvoiceItem['status'];
            if (totalPaid >= wo.grandTotal) {
                status = totalPaid > wo.grandTotal ? 'Overpaid' : 'Paid in Full';
            } else if (totalInvoiced > 0) {
                status = totalPaid > 0 ? 'Partially Paid' : 'Invoiced, Unpaid';
            } else if (totalInvoiced < wo.grandTotal && wo.status === 'completed') {
                 status = 'Partially Invoiced';
            }
             else {
                status = 'Uninvoiced';
            }

            return {
                workOrderId: wo.id!,
                workOrderNumber: wo.workOrderNumber,
                organizationName: wo.organizationName,
                projectValue: wo.grandTotal,
                totalInvoiced,
                totalPaid,
                totalDeductions,
                netReceivable,
                status,
            };
        }).sort((a,b) => b.projectValue - a.projectValue);
    }, [workOrders, allInvoices]);

    const totals = useMemo(() => ({
        projectValue: analyzedData.reduce((sum, d) => sum + d.projectValue, 0),
        invoiced: analyzedData.reduce((sum, d) => sum + d.totalInvoiced, 0),
        paid: analyzedData.reduce((sum, d) => sum + d.totalPaid, 0),
        deductions: analyzedData.reduce((sum, d) => sum + d.totalDeductions, 0),
        balance: analyzedData.reduce((sum, d) => sum + d.netReceivable, 0),
    }), [analyzedData]);


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="w-[95vw] max-w-6xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-4 shrink-0">
              <DialogTitle className="flex items-center"><Banknote className="mr-2 h-5 w-5 text-primary"/>Comprehensive Invoice & Payment Status</DialogTitle>
              <DialogDescription>
                An overview of invoicing and payment status across all your work orders.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6">
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Total Project Value</div><div className="text-md font-bold">{formatCurrency(totals.projectValue)}</div></div>
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Total Invoiced</div><div className="text-md font-bold">{formatCurrency(totals.invoiced)}</div></div>
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Total Paid</div><div className="text-md font-bold text-green-600">{formatCurrency(totals.paid)}</div></div>
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Total Deductions</div><div className="text-md font-bold text-orange-600">{formatCurrency(totals.deductions)}</div></div>
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Outstanding Balance</div><div className="text-md font-bold text-red-600">{formatCurrency(totals.balance)}</div></div>
                    </div>

                    {analyzedData.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">No work orders to analyze.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="min-w-full">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>WO #</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Project Value</TableHead>
                                        <TableHead className="text-right">Total Invoiced</TableHead>
                                        <TableHead className="text-right">Total Paid</TableHead>
                                        <TableHead className="text-right">Total Deductions</TableHead>
                                        <TableHead className="text-right">Net Receivable</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {analyzedData.map(item => (
                                        <TableRow key={item.workOrderId}>
                                            <TableCell className="whitespace-nowrap"><Link href={`/dashboard/work-orders/${item.workOrderId}`} className="text-primary hover:underline">{item.workOrderNumber}</Link></TableCell>
                                            <TableCell>{item.organizationName}</TableCell>
                                            <TableCell><Badge className={cn("text-xs whitespace-nowrap", statusColors[item.status])}>{item.status}</Badge></TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(item.projectValue)}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(item.totalInvoiced)}</TableCell>
                                            <TableCell className="text-right text-green-600 whitespace-nowrap">{formatCurrency(item.totalPaid)}</TableCell>
                                            <TableCell className="text-right text-orange-600 whitespace-nowrap">{formatCurrency(item.totalDeductions)}</TableCell>
                                            <TableCell className="text-right font-bold"><ProfitLossIndicator value={item.netReceivable} /></TableCell>
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

// Keep the single-WO modal as well, as it's used on the detail page.
export function WorkOrderInvoiceStatusModal({ isOpen, onOpenChange, workOrder, invoices }: WorkOrderInvoiceStatusModalProps) {
    if (!workOrder) return null;

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
    const totalDeductions = invoices.reduce((sum, inv) => {
        const otherDeductionsTotal = (inv.otherDeductions || []).reduce((s, d) => s + d.amount, 0);
        return sum + (inv.sdDeducted || 0) + (inv.tdsDeducted || 0) + (inv.ldDeducted || 0) + otherDeductionsTotal;
    }, 0);
    const totalBalance = totalInvoiced - totalPaid - totalDeductions;
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="w-[95vw] max-w-4xl h-auto max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-4 shrink-0">
              <DialogTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5 text-primary"/>Invoice & Payment Status</DialogTitle>
              <DialogDescription>
                A summary of all invoices and their payment statuses for Work Order #{workOrder.workOrderNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6">
                <div className="py-4 space-y-4">
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Total Invoiced</div><div className="text-md font-bold">{formatCurrency(totalInvoiced)}</div></div>
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Total Paid</div><div className="text-md font-bold text-green-600">{formatCurrency(totalPaid)}</div></div>
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Total Deductions</div><div className="text-md font-bold text-orange-600">{formatCurrency(totalDeductions)}</div></div>
                        <div className="p-2 border rounded-lg"><div className="text-xs text-muted-foreground">Outstanding Balance</div><div className="text-md font-bold text-red-600">{formatCurrency(totalBalance)}</div></div>
                    </div>
                    {invoices.length === 0 ? (
                        <div className="text-center py-10"><p className="text-muted-foreground">No invoices have been submitted for this work order yet.</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Deductions</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {invoices.map(inv => {
                                        const totalDeductions = (inv.sdDeducted || 0) + (inv.tdsDeducted || 0) + (inv.ldDeducted || 0) + (inv.otherDeductions || []).reduce((s,d)=>s+d.amount,0);
                                        return (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium whitespace-nowrap"><Link href={`/dashboard/invoices/${inv.id}/edit`} className="text-primary hover:underline">{inv.invoiceNumber}</Link></TableCell>
                                            <TableCell className="whitespace-nowrap">{formatDate(inv.date)}</TableCell>
                                            <TableCell><Badge variant="outline" className={`capitalize ${statusColors[inv.status] || ''}`}>{inv.status.replace("-"," ")}</Badge></TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(inv.grandTotal)}</TableCell>
                                            <TableCell className="text-right text-green-600 whitespace-nowrap">{formatCurrency(inv.amountPaid)}</TableCell>
                                            <TableCell className="text-right text-orange-600 whitespace-nowrap">{formatCurrency(totalDeductions)}</TableCell>
                                            <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">{formatCurrency(inv.balanceDue)}</TableCell>
                                        </TableRow>
                                        )
                                    })}
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
