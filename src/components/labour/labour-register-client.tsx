
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, HardHat, Eye, Edit, Trash2, Search, ArrowDownUp, AlertTriangle, Loader2, IndianRupee, Settings2, Clock, Printer, FileWarning } from "lucide-react";
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import type { LabourRegister, WorkOrder, TeamPermissions } from '@/types';
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
import LabourRegisterLoading from '@/app/dashboard/labour-register/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate } from '@/lib/utils';
import LabourSummaryPrintModal from '@/components/labour/labour-summary-print-modal';

interface LabourerCardProps {
  labourer: LabourRegister;
  onDelete: (id: string, name: string) => void;
  isDeleting: boolean;
  currentDeletingId: string | null;
  canManage: boolean;
  canManagePayments: boolean;
  canLogTime: boolean;
  setGlobalIsLoading: (loading: boolean) => void;
}

const LabourerCard = React.memo(({ labourer, onDelete, isDeleting, currentDeletingId, canManage, canManagePayments, canLogTime, setGlobalIsLoading }: LabourerCardProps) => (
    <Card className="shadow-sm flex flex-col h-full">
        <CardHeader className="pb-2">
            <CardTitle className="text-md">{labourer.workerName}</CardTitle>
            <CardDescription className="text-xs">{labourer.role}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-0.5 pt-1 pb-2 flex-grow">
            <p><span className="font-medium">WO#:</span> {labourer.workOrderNumber}</p>
            <p><span className="font-medium">Daily Wage:</span> {formatCurrency(labourer.dailyWage)}</p>
            <p className="font-semibold text-destructive">Net Payable: {formatCurrency(labourer.netAmount)}</p>
        </CardContent>
        <CardFooter className="flex justify-end gap-1 pt-3 border-t mt-auto">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">Actions <Settings2 className="ml-2 h-4 w-4"/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild disabled={!canManage} >
                        <Link href={`/dashboard/labour-register/${labourer.id}/edit`} onClick={() => setGlobalIsLoading(true)}><Edit className="mr-2 h-4 w-4"/>Edit Details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={!canLogTime} >
                      <Link href={`/dashboard/advance-tools/time-tracking?workOrderId=${labourer.workOrderId}&labourerId=${labourer.id}`} onClick={() => setGlobalIsLoading(true)}><Clock className="mr-2 h-4 w-4 text-violet-500"/>Log Time</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={!canManagePayments}>
                        <Link href={`/dashboard/labour-register/payment-history?labourerId=${labourer.id}`} onClick={() => setGlobalIsLoading(true)}><IndianRupee className="mr-2 h-4 w-4 text-green-500"/>View Payments</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canManage} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4"/>Delete Labourer
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {labourer.workerName}.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(labourer.id!, labourer.workerName)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Delete"}
                            </AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DropdownMenuContent>
            </DropdownMenu>
        </CardFooter>
    </Card>
));
LabourerCard.displayName = 'LabourerCard';


export default function LabourRegisterClientPage({ setLabourers, onDocStatusClick }: { setLabourers: React.Dispatch<React.SetStateAction<LabourRegister[]>>; onDocStatusClick: () => void; }) {
    const { user, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId } = useAuth();
    const { toast } = useToast();
    const [localLabourers, setLocalLabourers] = useState<LabourRegister[]>([]);
    const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
    const { setIsLoading: setGlobalIsLoading } = useLoading();
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof LabourRegister; direction: 'asc' | 'desc' } | null>({ key: 'workerName', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [filterWorkOrderId, setFilterWorkOrderId] = useState<string>('all');
    
    const canManageLabour = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageLabourRegister, [isViewingOwnAccount, currentTeamMemberPermissions]);
    const canManagePayments = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageLabourPayments, [isViewingOwnAccount, currentTeamMemberPermissions]);
    const canLogTime = useMemo(() => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageTimeTracking || !!currentTeamMemberPermissions?.canRecordLabourAttendance, [isViewingOwnAccount, currentTeamMemberPermissions]);

    const fetchLabourData = useCallback(async () => {
        if (!user || !dataOwnerId) { setIsLoading(false); return; }
        if (!canManageLabour) {
            if (!authLoading) {
                toast({ title: "Permission Denied", description: "You cannot manage the labour register.", variant: "destructive" });
            }
            setIsLoading(false); 
            return; 
        }
        
        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const [labourResponse, woResponse] = await Promise.all([
                fetch(`/api/labour-register?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
            ]);

            if (!labourResponse.ok) throw new Error((await labourResponse.json()).error || 'Failed to fetch labourers.');
            const fetchedLabourers = await labourResponse.json();
            setLocalLabourers(fetchedLabourers);
            setLabourers(fetchedLabourers);

            if (woResponse.ok) {
                const woData: WorkOrder[] = await woResponse.json();
                setWorkOrders(woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));
            }

        } catch (error: any) {
            toast({ title: "Error", description: `Could not load data: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, dataOwnerId, canManageLabour, toast, setLabourers]);

    useEffect(() => {
        if (!authLoading && dataOwnerId) {
            fetchLabourData();
        }
    }, [authLoading, dataOwnerId, fetchLabourData]);

    const handleDelete = async (labourerId: string, labourerName: string) => {
        if (!canManageLabour) return;
        setIsDeleting(true); setCurrentDeletingId(labourerId);
        try {
            const idToken = await user!.getIdToken();
            const response = await fetch(`/api/labour-register/${labourerId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 409) {
                     toast({ title: "Deletion Blocked", description: errorData.error, variant: "destructive", duration: 7000 });
                } else {
                    throw new Error(errorData.error || 'Failed to delete labourer.');
                }
            } else {
                toast({ title: "Success", description: `${labourerName} removed.` });
                const updatedLabourers = localLabourers.filter(l => l.id !== labourerId);
                setLocalLabourers(updatedLabourers);
                setLabourers(updatedLabourers);
            }
        } catch (error: any) {
            toast({ title: "Error", description: `Could not delete labourer: ${error.message}`, variant: "destructive" });
        } finally {
            setIsDeleting(false); setCurrentDeletingId(null);
        }
    };
    
    const sortedAndFilteredLabourers = useMemo(() => {
        return localLabourers
            .filter(l => filterWorkOrderId === 'all' || l.workOrderId === filterWorkOrderId)
            .filter(l => 
                l.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                l.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (l.workOrderNumber && l.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .sort((a, b) => {
                if (!sortConfig) return 0;
                const aValue = a[sortConfig.key]; 
                const bValue = b[sortConfig.key];
                if (aValue === null || aValue === undefined) return 1; 
                if (bValue === null || bValue === undefined) return -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') { return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1); }
                if (typeof aValue === 'string' && typeof bValue === 'string') { return aValue.localeCompare(bValue as string) * (sortConfig.direction === 'asc' ? 1 : -1); }
                return 0;
            });
    }, [localLabourers, searchTerm, sortConfig, filterWorkOrderId]);

    const totalPages = Math.ceil(sortedAndFilteredLabourers.length / itemsPerPage);
    const paginatedLabourers = sortedAndFilteredLabourers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (isLoading || authLoading) return <LabourRegisterLoading />;
    if (!canManageLabour) { return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="w-16 h-16 text-destructive mb-4" /><h2 className="text-xl font-semibold">Permission Denied</h2><p className="text-muted-foreground">You cannot manage the labour register.</p><Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard">Back to Dashboard</Link></Button></div> ); }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div><h1 className="text-2xl font-semibold flex items-center"><HardHat className="mr-3 h-7 w-7 text-primary" /> Labour Register</h1><p className="text-muted-foreground">Manage your workforce, their roles, and documentation.</p></div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onDocStatusClick}>
                        <FileWarning className="mr-2 h-4 w-4 text-orange-500" /> Doc Status
                    </Button>
                     <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsPrintModalOpen(true)}>
                        <Printer className="mr-2 h-4 w-4" /> Generate Report
                    </Button>
                    <Button asChild className="w-full sm:w-auto" variant="outline" onClick={() => setGlobalIsLoading(true)} disabled={!canLogTime}>
                      <Link href="/dashboard/advance-tools/time-tracking">
                          <span className="flex items-center"><Clock className="mr-2 h-4 w-4"/> Attendance</span>
                      </Link>
                    </Button>
                    <Button asChild className="w-full sm:w-auto" variant="outline" onClick={() => setGlobalIsLoading(true)} disabled={!canManagePayments}>
                      <Link href="/dashboard/labour-register/payment-history">
                          <span className="flex items-center"><IndianRupee className="mr-2 h-4 w-4"/> Payment History</span>
                      </Link>
                    </Button>
                     <Button asChild className="w-full sm:w-auto" variant="outline" onClick={() => setGlobalIsLoading(true)} disabled={!canManagePayments}>
                      <Link href="/dashboard/labour-register/advances/new">
                          <span className="flex items-center"><IndianRupee className="mr-2 h-4 w-4"/> Record Payment</span>
                      </Link>
                    </Button>
                    <Button asChild className="w-full sm:w-auto" disabled={!canManageLabour} onClick={() => setGlobalIsLoading(true)}>
                        <Link href="/dashboard/labour-register/new"><PlusCircle className="mr-2 h-5 w-5" /> Add New Labourer</Link>
                    </Button>
                </div>
            </div>

            <Card className="shadow-lg">
                <CardHeader><CardTitle>Your Labourers</CardTitle>
                 <div className="pt-2 flex flex-col md:flex-row gap-2">
                    <Input placeholder="Search by Name, Role, WO#..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />} />
                    <Combobox options={[{ value: 'all', label: 'All Work Orders' }, ...workOrders]} value={filterWorkOrderId} onChange={(val) => { setFilterWorkOrderId(val); setCurrentPage(1); }} placeholder="Filter by Work Order..." className="w-full md:w-[250px]" disabled={isLoading} />
                 </div>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden grid gap-4 sm:grid-cols-2">
                       {paginatedLabourers.length === 0 ? <p className="text-muted-foreground text-center py-8 col-span-full">No labourers found.</p> : paginatedLabourers.map(l => <LabourerCard key={l.id} labourer={l} onDelete={handleDelete} isDeleting={isDeleting} currentDeletingId={currentDeletingId} canManage={canManageLabour} canManagePayments={canManagePayments} canLogTime={canLogTime} setGlobalIsLoading={setGlobalIsLoading} />)}
                    </div>
                    <div className="hidden md:block">
                        {paginatedLabourers.length === 0 ? <p className="text-muted-foreground text-center py-12">No labourers found.</p> : (
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Work Order</TableHead><TableHead className="text-right">Daily Wage</TableHead><TableHead className="text-right">Net Payable</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                {paginatedLabourers.map((labourer) => (
                                    <TableRow key={labourer.id}>
                                        <TableCell className="font-medium">{labourer.workerName}</TableCell><TableCell>{labourer.role}</TableCell><TableCell>{labourer.workOrderNumber}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(labourer.dailyWage)}</TableCell>
                                        <TableCell className="text-right font-bold text-destructive">{formatCurrency(labourer.netAmount)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <Settings2 className="h-4 w-4" />
                                                        <span className="sr-only">Actions</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild disabled={!canManageLabour} >
                                                        <Link href={`/dashboard/labour-register/${labourer.id}/edit`} onClick={() => setGlobalIsLoading(true)}><Edit className="mr-2 h-4 w-4"/>Edit Details</Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild disabled={!canLogTime} >
                                                      <Link href={`/dashboard/advance-tools/time-tracking?workOrderId=${labourer.workOrderId}&labourerId=${labourer.id}`} onClick={() => setGlobalIsLoading(true)}><Clock className="mr-2 h-4 w-4 text-violet-500"/>Log Time</Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild disabled={!canManagePayments}>
                                                        <Link href={`/dashboard/labour-register/payment-history?labourerId=${labourer.id}`} onClick={() => setGlobalIsLoading(true)}><IndianRupee className="mr-2 h-4 w-4 text-green-500"/>View Payments</Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canManageLabour || isDeleting} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                <Trash2 className="mr-2 h-4 w-4"/>Delete Labourer
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {labourer.workerName}.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(labourer.id!, labourer.workerName)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                            </div>
                        )}
                    </div>
                </CardContent>
                {sortedAndFilteredLabourers.length > 0 && !isLoading && (
                <CardFooter className="border-t pt-2">
                    <DataTablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={localLabourers.length} filteredItemCount={sortedAndFilteredLabourers.length}/>
                </CardFooter>
                )}
            </Card>

             <LabourSummaryPrintModal
                isOpen={isPrintModalOpen}
                onOpenChange={setIsPrintModalOpen}
                userId={dataOwnerId!}
                user={user}
            />
        </div>
    );
}
