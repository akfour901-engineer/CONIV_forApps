
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { UserSubmission, UserSubmissionStatus } from '@/types';
import { USER_SUBMISSION_STATUS_OPTIONS } from '@/types';
import { MessageSquare, Save, Loader2, Filter, AlertTriangle, Eye, Send, ArrowLeft, ArrowDownUp, Search } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import UserSubmissionsLoadingSkeleton from './loading';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useLoading } from '@/contexts/loading-context';


export default function UserSubmissionsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [filterStatus, setFilterStatus] = useState<UserSubmissionStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof UserSubmission; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [selectedSubmission, setSelectedSubmission] = useState<UserSubmission | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [adminReply, setAdminReply] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<UserSubmissionStatus>('New');
  const [isUpdatingSubmission, setIsUpdatingSubmission] = useState(false);


  useEffect(() => {
    if (authLoading) return;
    if (user && isAdmin) {
      const fetchSubmissions = async () => {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken();
          const apiUrl = `/api/admin/user-submissions?status=${filterStatus}`;
          const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
          }
          const data: UserSubmission[] = await response.json();
          setSubmissions(data);
        } catch (error:any) {
          console.error("Error fetching user submissions (via API):", error);
          toast({ title: "Error Loading Submissions", description: error.message || "Could not load submissions.", variant: "destructive" });
          setSubmissions([]); 
        }
        setIsLoading(false);
      };
      fetchSubmissions();
    } else if (!isAdmin) {
        setIsLoading(false);
    }
  }, [user, isAdmin, filterStatus, toast, authLoading]);
  
  const sortedAndFilteredSubmissions = useMemo(() => {
    let filtered = submissions.filter(sub => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        sub.subject.toLowerCase().includes(searchTermLower) ||
        (sub.userName && sub.userName.toLowerCase().includes(searchTermLower)) ||
        (sub.userEmail && sub.userEmail.toLowerCase().includes(searchTermLower)) ||
        sub.submissionType.toLowerCase().includes(searchTermLower) ||
        sub.status.toLowerCase().includes(searchTermLower)
      );
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (sortConfig.key === 'createdAt' || sortConfig.key === 'updatedAt') {
            return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [submissions, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredSubmissions.length / itemsPerPage);
  const paginatedSubmissions = sortedAndFilteredSubmissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof UserSubmission, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };


  const handleOpenManageModal = (submission: UserSubmission) => {
    setSelectedSubmission(submission);
    setAdminReply(submission.adminReplyMessage || '');
    setAdminNotes(submission.adminNotes || '');
    setNewStatus(submission.status);
    setIsManageModalOpen(true);
  };

  const handleSaveSubmissionUpdate = async () => {
    if (!selectedSubmission || !user || !isAdmin) return;
    setIsUpdatingSubmission(true);
    try {
      const idToken = await user.getIdToken();
      const updatePayload: Partial<Pick<UserSubmission, 'status' | 'adminReplyMessage' | 'adminNotes'>> = {};
      if (newStatus !== selectedSubmission.status) updatePayload.status = newStatus;
      if (adminReply.trim() !== (selectedSubmission.adminReplyMessage || '').trim()) updatePayload.adminReplyMessage = adminReply.trim() || null;
      if (adminNotes.trim() !== (selectedSubmission.adminNotes || '').trim()) updatePayload.adminNotes = adminNotes.trim() || null;
      
      if (Object.keys(updatePayload).length === 0) {
        toast({ title: "No Changes", description: "No changes detected to save." });
        setIsManageModalOpen(false);
        setIsUpdatingSubmission(false);
        return;
      }

      const response = await fetch(`/api/admin/user-submissions/${selectedSubmission.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      
      const updatedSubmission: UserSubmission = await response.json();
      toast({ title: "Success", description: "Submission updated." });
      setSubmissions(prev => prev.map(s => s.id === updatedSubmission.id ? updatedSubmission : s));
      setIsManageModalOpen(false);
    } catch (error: any) {
      console.error("Error updating submission (via API):", error);
      toast({ title: "Error", description: `Could not update submission: ${error.message}`, variant: "destructive" });
    }
    setIsUpdatingSubmission(false);
  };
  
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    try { return format(parseISO(isoString), 'dd MMM yy, p'); }
    catch (e) { return 'Invalid Date'; }
  };

  const statusBadgeVariant = (status: UserSubmissionStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'New': return 'secondary';
      case 'Open': case 'In Progress': return 'default';
      case 'Resolved': case 'Closed': return 'outline';
      case 'Awaiting User Response': return 'destructive';
      default: return 'outline';
    }
  };
  
  if (authLoading) return <UserSubmissionsLoadingSkeleton />;
  if (!isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to view user submissions.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center">
          <MessageSquare className="mr-3 h-7 w-7 text-primary" /> User Submissions
        </h1>
        <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
            </Link>
          </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Track User Feedback, Queries &amp; Complaints</CardTitle>
          <CardDescription>Review and manage all submissions from users.</CardDescription>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by Subject, User, Type..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as UserSubmissionStatus | 'all')}>
                <SelectTrigger className="w-full md:w-[220px]">
                    <SelectValue placeholder="Filter by status..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {USER_SUBMISSION_STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status} className="capitalize">{status.replace(/_/g, ' ')}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'none'}>
              <SelectTrigger className="w-full md:w-[180px]">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4" />
                  <SelectValue placeholder="Sort by..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt_desc">Date: Newest</SelectItem>
                <SelectItem value="createdAt_asc">Date: Oldest</SelectItem>
                <SelectItem value="subject_asc">Subject (A-Z)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <UserSubmissionsLoadingSkeleton /> : paginatedSubmissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No submissions match the current filter or no submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubmissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium truncate max-w-xs" title={sub.subject}>{sub.subject}</TableCell>
                    <TableCell>{sub.submissionType}</TableCell>
                    <TableCell>{sub.userName || sub.userEmail}</TableCell>
                    <TableCell>{formatDate(sub.createdAt)}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(sub.status)} className="capitalize">{sub.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenManageModal(sub)}>
                        <Eye className="mr-2 h-4 w-4" /> Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
         <CardFooter className="border-t pt-2">
           <DataTablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            itemCount={submissions.length}
            filteredItemCount={sortedAndFilteredSubmissions.length}
           />
        </CardFooter>
      </Card>

      {selectedSubmission && (
        <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Submission: {selectedSubmission.subject}</DialogTitle>
              <DialogDescription>
                From: {selectedSubmission.userName || selectedSubmission.userEmail} on {formatDate(selectedSubmission.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <p className="text-sm"><strong>User`s Message:</strong></p>
              <Textarea value={selectedSubmission.description} readOnly rows={6} className="bg-muted/50"/>
              {selectedSubmission.attachmentUrl && (
                <p className="text-sm"><strong>Attachment:</strong> <Button variant="link" asChild className="p-0 h-auto"><a href={selectedSubmission.attachmentUrl} target="_blank" rel="noopener noreferrer">View Attachment</a></Button></p>
              )}
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="adminReply">Admin Reply (Visible to User)</Label>
                <Textarea id="adminReply" value={adminReply} onChange={(e) => setAdminReply(e.target.value)} placeholder="Type your reply to the user here..." rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminNotes">Internal Admin Notes (Not visible to user)</Label>
                <Textarea id="adminNotes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Internal notes..." rows={3} />
              </div>
              <div className="space-y-2">
                 <Label htmlFor="newStatus">Update Status</Label>
                 <Select value={newStatus} onValueChange={(val) => setNewStatus(val as UserSubmissionStatus)}>
                    <SelectTrigger id="newStatus"><SelectValue placeholder="Select new status" /></SelectTrigger>
                    <SelectContent>
                        {USER_SUBMISSION_STATUS_OPTIONS.map(sOpt => <SelectItem key={sOpt} value={sOpt} className="capitalize">{sOpt.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="button" onClick={handleSaveSubmissionUpdate} disabled={isUpdatingSubmission}>
                {isUpdatingSubmission ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
