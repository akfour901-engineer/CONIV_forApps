
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { MailWarning, PlusCircle, Search, Trash2, Loader2, Send } from "lucide-react";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { MailingListEntry } from '@/types/server-only';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewMailingListEntryDialog } from './new-mailing-list-entry-dialog';

export default function MailingListClientPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [entries, setEntries] = useState<MailingListEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isNewEntryDialogOpen, setIsNewEntryDialogOpen] = useState(false);
    const [isTriggering, setIsTriggering] = useState(false);

    const fetchMailingList = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/admin/mailing-list', { headers: { 'Authorization': `Bearer ${idToken}` } });
            if (!response.ok) throw new Error('Failed to fetch mailing list.');
            setEntries(await response.json());
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        setIsLoading(false);
    }, [user, toast]);

    useEffect(() => {
        fetchMailingList();
    }, [fetchMailingList]);

    const handleTriggerWeeklyEmails = async () => {
        if (!user) return;
        setIsTriggering(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/admin/mailing-list?action=triggerWeeklyEmails', { headers: { 'Authorization': `Bearer ${idToken}` } });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to trigger weekly emails job.');
            toast({ title: "Job Triggered", description: `Processed ${result.processedUsers} users. Sent ${result.sentEmails} emails. Errors: ${result.errors.length}.`, duration: 10000 });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        setIsTriggering(false);
    }
    
    const filteredEntries = useMemo(() => entries.filter(e =>
        e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.name && e.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.company && e.company.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [entries, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center">
                        <MailWarning className="mr-3 h-7 w-7 text-primary" /> Mailing List Management
                    </h1>
                    <p className="text-muted-foreground">Manage your marketing and outreach contacts.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={() => setIsNewEntryDialogOpen(true)} className="w-full sm:w-auto">
                        <PlusCircle className="mr-2 h-5 w-5" /> Add New Entry
                    </Button>
                </div>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Manual Job Trigger</CardTitle>
                    <CardDescription>
                        This button simulates the daily cron job that sends weekly digest emails. Use it for testing purposes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleTriggerWeeklyEmails} disabled={isTriggering}>
                        {isTriggering ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        Run Weekly Email Job
                    </Button>
                </CardContent>
            </Card>

            <NewMailingListEntryDialog
                isOpen={isNewEntryDialogOpen}
                onOpenChange={setIsNewEntryDialogOpen}
                onEntryAdded={fetchMailingList}
            />

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Contact List</CardTitle>
                    <div className="pt-2">
                        <Input
                            placeholder="Search by name, email, or company..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-md"
                            icon={<Search className="h-4 w-4 text-muted-foreground" />}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Added On</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={7}><div className="h-5 bg-gray-200 rounded-md animate-pulse"></div></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredEntries.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24">No entries found.</TableCell></TableRow>
                                ) : (
                                    filteredEntries.map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-medium">{entry.email}</TableCell>
                                            <TableCell>{entry.name || 'N/A'}</TableCell>
                                            <TableCell>{entry.company || 'N/A'}</TableCell>
                                            <TableCell className="capitalize">{entry.status.replace(/_/g, ' ')}</TableCell>
                                            <TableCell className="capitalize">{entry.source}</TableCell>
                                            <TableCell>{format(new Date(entry.createdAt), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" disabled><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

