'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, AlertTriangle, Loader2, ArrowLeft, Search, ArrowDownUp, PlusCircle, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from "@/hooks/use-auth";
import type { MailingListEntry, MailingListEntryStatus } from '@/types';
import { MAILING_LIST_STATUS_OPTIONS } from '@/types';
import { format, parseISO } from 'date-fns';
import MailDatabaseLoadingSkeleton from './loading';
import { useToast } from '@/hooks/use-toast';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { useLoading } from '@/contexts/loading-context';


const entryFormSchema = z.object({
  email: z.string().email("Invalid email format."),
  name: z.string().max(100).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  status: z.enum(MAILING_LIST_STATUS_OPTIONS).default('manual_entry'),
  notes: z.string().max(1000).optional().nullable(),
});

type EntryFormValues = z.infer<typeof entryFormSchema>;

export default function AdminMailDatabasePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<MailingListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof MailingListEntry; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: { email: "", name: "", company: "", phone: "", status: "manual_entry", notes: "" },
  });

  const fetchEntries = useCallback(async () => {
    if (!user || !isAdmin) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/mailing-list', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch mailing list.');
      setEntries(await response.json());
    } catch (error: any) {
      toast({ title: "Error Loading Data", description: error.message, variant: "destructive"});
    }
    setIsLoading(false);
  }, [user, isAdmin, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchEntries();
    }
  }, [authLoading, fetchEntries]);

  const onAddEntry = async (values: EntryFormValues) => {
    setIsSubmitting(true);
    try {
      if (!user) throw new Error("Authentication required.");
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/mailing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, userId: user.uid }) // Assuming admin adds to their own context, adjust if needed
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to add entry.');
      toast({ title: "Success", description: "New entry added to the mail database." });
      form.reset();
      fetchEntries(); // Refresh the list
    } catch (error: any) {
      toast({ title: "Error Adding Entry", description: error.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const sortedAndFilteredEntries = useMemo(() => {
    let filtered = entries.filter(entry => {
      const searchTermLower = searchTerm.toLowerCase();
      return Object.values(entry).some(val => 
        String(val).toLowerCase().includes(searchTermLower)
      );
    });
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [entries, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredEntries.length / itemsPerPage);
  const paginatedEntries = sortedAndFilteredEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('_') as [keyof MailingListEntry, 'asc' | 'desc'];
    setSortConfig({ key, direction });
  };

  const formatDate = (isoString: string) => format(parseISO(isoString), 'dd MMM yyyy, p');

  if (authLoading) return <MailDatabaseLoadingSkeleton />;
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/admin">Back to Admin Panel</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
                <Mail className="mr-3 h-7 w-7 text-primary" /> Mail Database
            </h1>
            <p className="text-muted-foreground">Manage your outreach list. New signups are added automatically.</p>
          </div>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel</Link></Button>
        </div>

        <Card className="shadow-lg">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddEntry)}>
                    <CardHeader><CardTitle>Add New Entry Manually</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email*</FormLabel><FormControl><Input placeholder="contractor@email.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="company" render={({ field }) => ( <FormItem><FormLabel>Company</FormLabel><FormControl><Input placeholder="Acme Construction" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" placeholder="+91..." {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem className="md:col-span-2 lg:col-span-3"><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="e.g., Met at expo, interested in invoicing module." {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )} />
                    </CardContent>
                    <CardFooter> <Button type="submit" disabled={isSubmitting}><Save className="mr-2 h-4 w-4" />{isSubmitting ? "Adding..." : "Add Entry"}</Button></CardFooter>
                </form>
            </Form>
        </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Mail Entries</CardTitle>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="max-w-md" icon={<Search className="h-4 w-4 text-muted-foreground" />}/>
             <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'createdAt_desc'}>
              <SelectTrigger className="w-full md:w-[180px]"><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><SelectValue placeholder="Sort by..." /></div></SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt_desc">Date Added: Newest</SelectItem>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                <SelectItem value="status_asc">Status (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (<MailDatabaseLoadingSkeleton />) : paginatedEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No entries found.</p>
          ) : (
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead>
                    <TableHead>Added On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.email}</TableCell>
                      <TableCell>{entry.name || 'N/A'}</TableCell>
                      <TableCell>{entry.company || 'N/A'}</TableCell>
                      <TableCell>{entry.phone || 'N/A'}</TableCell>
                      <TableCell><Badge variant={entry.status === 'signed_up' ? 'default' : 'secondary'} className="capitalize">{entry.status.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="capitalize">{entry.source}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(entry.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
         {sortedAndFilteredEntries.length > 0 && !isLoading && (
          <CardFooter className="border-t pt-2">
           <DataTablePagination 
            currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
            canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages}
            itemCount={entries.length} filteredItemCount={sortedAndFilteredEntries.length}/>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}