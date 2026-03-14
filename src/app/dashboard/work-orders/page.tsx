'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, PieChart, Banknote } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, Invoice } from '@/types';
import { useLoading } from '@/contexts/loading-context';
import WorkOrdersLoading from './loading';
import WorkOrdersClientPage from '@/components/dashboard/work-orders/work-orders-client';
import { ComprehensiveSdAnalyzerModal } from '@/components/dashboard/work-orders/comprehensive-sd-analyzer-modal';
import { ComprehensiveInvoiceStatusModal } from '@/components/dashboard/work-orders/comprehensive-invoice-status-modal';

export default function WorkOrdersPage() {
    const { user, dataOwnerId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { setIsLoading: setGlobalIsLoading } = useLoading();
    
    const [isComprehensiveSdModalOpen, setIsComprehensiveSdModalOpen] = useState(false);
    const [isComprehensiveInvoiceModalOpen, setIsComprehensiveInvoiceModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user || !dataOwnerId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const [woResponse, invoiceResponse] = await Promise.all([
                fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                fetch(`/api/invoices?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
            ]);

            if (!woResponse.ok) throw new Error((await woResponse.json()).error || 'Failed to fetch Work Orders.');
            setWorkOrders(await woResponse.json());

            if (invoiceResponse.ok) {
                setAllInvoices(await invoiceResponse.json());
            } else {
                 console.warn("Could not fetch invoices for comprehensive status modal.");
            }

        } catch (error: any) {
            toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, dataOwnerId, toast]);

    useEffect(() => {
        if (!authLoading) {
            fetchData();
        }
    }, [authLoading, fetchData]);

    if (isLoading || authLoading) {
        return <WorkOrdersLoading />;
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold flex items-center">Work Orders</h1>
                        <p className="text-muted-foreground">Track and manage all your work orders.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap justify-end">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsComprehensiveSdModalOpen(true)}>
                            <PieChart className="mr-2 h-4 w-4"/>SD Analyzer
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsComprehensiveInvoiceModalOpen(true)}>
                            <Banknote className="mr-2 h-4 w-4"/>Invoice Status
                        </Button>
                        <Button asChild className="w-full sm:w-auto" onClick={() => setGlobalIsLoading(true)}>
                            <Link href="/dashboard/work-orders/new">
                                <PlusCircle className="mr-2 h-5 w-5" /> Create New WO
                            </Link>
                        </Button>
                    </div>
                </div>

                <WorkOrdersClientPage 
                    workOrders={workOrders} 
                    allInvoices={allInvoices} 
                    isLoading={isLoading} 
                    refetchData={fetchData}
                />
            </div>
            
            <ComprehensiveSdAnalyzerModal 
                isOpen={isComprehensiveSdModalOpen}
                onOpenChange={setIsComprehensiveSdModalOpen}
                workOrders={workOrders}
            />

            <ComprehensiveInvoiceStatusModal 
                isOpen={isComprehensiveInvoiceModalOpen}
                onOpenChange={setIsComprehensiveInvoiceModalOpen}
                workOrders={workOrders}
                allInvoices={allInvoices}
            />
        </>
    );
}
