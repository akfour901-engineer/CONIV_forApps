'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Mail, Trash2, Search, AlertTriangle, Loader2, Send, Users, Contact, Settings2, Sparkles, Edit, ArrowDownUp, Info } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { MailingList, MailingListEntry, MailingListContent, MailingListCampaign, Organization, Subcontractor } from '@/types/server-only';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import MailingListLoading from '@/app/dashboard/marketing/mailing-list/loading';
import { useLoading } from '@/contexts/loading-context';
import { NewContactDialog } from './new-contact-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { NewMailingListDialog } from './new-mailing-list-dialog';
import { ManageListContactsDialog } from './manage-list-contacts-dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { DataTablePagination } from '../ui/data-table-pagination';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

const ContactCard = React.memo(
  ({
    contact,
    lists,
    onEdit,
    onDelete,
    isDeleting,
    currentDeletingId,
  }: {
    contact: MailingListEntry;
    lists: MailingList[];
    onEdit: (contact: MailingListEntry) => void;
    onDelete: (id: string, email: string) => void;
    isDeleting: boolean;
    currentDeletingId: string | null;
  }) => {
    const contactLists = lists
      .filter((l) => contact.mailingListIds?.includes(l.id!))
      .map((l) => l.name);

    return (
      <Card className="overflow-hidden border shadow-sm hover:shadow transition-shadow">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle
            className="text-base font-semibold leading-tight break-words line-clamp-2"
            title={contact.name || contact.email}
          >
            {contact.name || contact.email}
          </CardTitle>

          <CardDescription className="text-sm break-all line-clamp-1 mt-0.5" title={contact.email}>
            {contact.email}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 pb-3 text-sm space-y-1.5">
          <p
            className="break-words line-clamp-1 text-muted-foreground"
            title={contact.company || 'No company'}
          >
            {contact.company || 'No company'}
          </p>

          <p className="text-xs text-muted-foreground/80 break-words line-clamp-1 pt-1">
            {contactLists.length > 0 ? contactLists.join(' • ') : 'Not in any list'}
          </p>
        </CardContent>

        <CardFooter className="px-4 py-3 border-t flex justify-end gap-2 bg-muted/30">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(contact)}
            disabled={isDeleting}
          >
            <Edit className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                disabled={isDeleting && currentDeletingId === contact.id}
              >
                {isDeleting && currentDeletingId === contact.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove <strong>{contact.email}</strong>.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(contact.id!, contact.email)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    );
  }
);
ContactCard.displayName = 'ContactCard';

export default function MailingListClientPage() {
  const { user, loading: authLoading, dataOwnerId, currentTeamMemberPermissions, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [lists, setLists] = useState<MailingList[]>([]);
  const [entries, setEntries] = useState<MailingListEntry[]>([]);
  const [contents, setContents] = useState<MailingListContent[]>([]);
  const [campaigns, setCampaigns] = useState<MailingListCampaign[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [isManageContactsModalOpen, setIsManageContactsModalOpen] = useState(false);
  const [selectedListForManagement, setSelectedListForManagement] = useState<MailingList | null>(null);

  const [campaignName, setCampaignName] = useState('');
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [selectedListIdsForCampaign, setSelectedListIdsForCampaign] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<MailingListEntry | null>(null);

  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [contactSortConfig, setContactSortConfig] = useState<
    { key: keyof MailingListEntry; direction: 'asc' | 'desc' } | null
  >({ key: 'name', direction: 'asc' });
  const [contactCurrentPage, setContactCurrentPage] = useState(1);
  const [contactItemsPerPage, setContactItemsPerPage] = useState(10);

  const [campaignCurrentPage, setCampaignCurrentPage] = useState(1);
  const [campaignItemsPerPage, setCampaignItemsPerPage] = useState(5);

  const canManageMailingList = useMemo(
    () => isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageMailingList,
    [isViewingOwnAccount, currentTeamMemberPermissions]
  );

  const fetchMailingData = useCallback(async () => {
    if (!user || !dataOwnerId || !canManageMailingList) {
      if (!authLoading && !canManageMailingList)
        toast({ title: "Permission Denied", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setGlobalIsLoading(true);
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const [listsRes, entriesRes, contentRes, campaignsRes, orgRes, subRes] = await Promise.all([
        fetch(`/api/marketing/mailing-lists?dataOwnerId=${dataOwnerId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/marketing/mailing-list-entries?dataOwnerId=${dataOwnerId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/marketing/content?dataOwnerId=${dataOwnerId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/marketing/campaigns?dataOwnerId=${dataOwnerId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/organizations?dataOwnerId=${dataOwnerId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/subcontractors?dataOwnerId=${dataOwnerId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      ]);

      if (listsRes.ok) setLists(await listsRes.json());
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (contentRes.ok) setContents(await contentRes.json());
      if (campaignsRes.ok) setCampaigns(await campaignsRes.json());
      if (orgRes.ok) setOrganizations(await orgRes.json());
      if (subRes.ok) setSubcontractors(await subRes.json());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setGlobalIsLoading(false);
    }
  }, [user, dataOwnerId, canManageMailingList, authLoading, toast, setGlobalIsLoading]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchMailingData();
    }
  }, [authLoading, dataOwnerId, fetchMailingData]);

  const handleOpenManageContacts = (list: MailingList) => {
    setSelectedListForManagement(list);
    setIsManageContactsModalOpen(true);
  };

  const handleEditContact = (contact: MailingListEntry) => {
    setEditingContact(contact);
    setIsNewContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId: string, contactEmail: string) => {
    setIsDeleting(true);
    setCurrentDeletingId(contactId);
    try {
      const idToken = await user!.getIdToken();
      const response = await fetch(`/api/marketing/mailing-list-entries/${contactId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error("Failed to delete contact.");
      toast({
        title: "Contact Deleted",
        description: `${contactEmail} has been removed from your lists.`,
      });
      fetchMailingData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setCurrentDeletingId(null);
    }
  };

  const handleSendCampaign = async () => {
    setGlobalIsLoading(true);
    if (!campaignName.trim() || !selectedContentId || selectedListIdsForCampaign.length === 0) {
      toast({
        title: "Missing Information",
        description: "Campaign name, content, and at least one mailing list are required.",
        variant: "destructive",
      });
      setGlobalIsLoading(false);
      return;
    }
    if (!user || !dataOwnerId) {
      setGlobalIsLoading(false);
      return;
    }

    setIsSending(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          dataOwnerId,
          campaignName,
          contentId: selectedContentId,
          mailingListIds: selectedListIdsForCampaign,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send campaign.');

      toast({ title: "Campaign Sent!", description: `Your campaign "${campaignName}" is being sent.` });
      setCampaignName('');
      setSelectedContentId('');
      setSelectedListIdsForCampaign([]);
      fetchMailingData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
      setGlobalIsLoading(false);
    }
  };

  const handleToggleListForCampaign = (listId: string) => {
    setSelectedListIdsForCampaign((prev) =>
      prev.includes(listId) ? prev.filter((id) => id !== listId) : [...prev, listId]
    );
  };

  const handleContactSortChange = (value: string) => {
    const [key, direction] = value.split('_') as [keyof MailingListEntry, 'asc' | 'desc'];
    setContactSortConfig({ key, direction });
  };

  const sortedAndFilteredEntries = useMemo(() => {
    let filtered = entries.filter(
      (entry) =>
        entry.email.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
        (entry.name && entry.name.toLowerCase().includes(contactSearchTerm.toLowerCase())) ||
        (entry.company && entry.company.toLowerCase().includes(contactSearchTerm.toLowerCase()))
    );

    if (contactSortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[contactSortConfig.key] || '';
        const bVal = b[contactSortConfig.key] || '';
        return aVal.toString().localeCompare(bVal.toString()) * (contactSortConfig.direction === 'asc' ? 1 : -1);
      });
    }
    return filtered;
  }, [entries, contactSearchTerm, contactSortConfig]);

  const contactTotalPages = Math.ceil(sortedAndFilteredEntries.length / contactItemsPerPage);
  const paginatedContacts = sortedAndFilteredEntries.slice(
    (contactCurrentPage - 1) * contactItemsPerPage,
    contactCurrentPage * contactItemsPerPage
  );

  const campaignTotalPages = Math.ceil(campaigns.length / campaignItemsPerPage);
  const paginatedCampaigns = campaigns.slice(
    (campaignCurrentPage - 1) * campaignItemsPerPage,
    campaignCurrentPage * campaignItemsPerPage
  );

  if (authLoading || isLoading) return <MailingListLoading />;
  if (!canManageMailingList) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage mailing lists.</p>
      </div>
    );
  }

  return (
    <>
      <NewContactDialog
        isOpen={isNewContactModalOpen}
        onOpenChange={(open) => {
          if (!open) setEditingContact(null);
          setIsNewContactModalOpen(open);
        }}
        onContactAdded={fetchMailingData}
        onContactUpdated={fetchMailingData}
        mailingLists={lists}
        organizations={organizations}
        subcontractors={subcontractors}
        editingContact={editingContact}
      />
      <NewMailingListDialog
        isOpen={isNewListModalOpen}
        onOpenChange={setIsNewListModalOpen}
        onListAdded={fetchMailingData}
      />
      <ManageListContactsDialog
        isOpen={isManageContactsModalOpen}
        onOpenChange={setIsManageContactsModalOpen}
        list={selectedListForManagement}
        allContacts={entries}
        onUpdate={fetchMailingData}
      />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <Mail className="mr-3 h-7 w-7 text-primary" />
              Mailing Lists & Campaigns
            </h1>
            <p className="text-muted-foreground">Manage your contacts, lists, and email campaigns.</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-2 w-full sm:w-auto">
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setGlobalIsLoading(true)}
            >
              <Link href="/dashboard/marketing/content">
                <Sparkles className="mr-2 h-4 w-4" />
                Manage Content
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsNewListModalOpen(true)}
              className="w-full sm:w-auto"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              New List
            </Button>
            <Button onClick={() => setIsNewContactModalOpen(true)} className="w-full sm:w-auto">
              <Contact className="mr-2 h-5 w-5" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Campaign creation card – unchanged */}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Create & Send a Campaign</CardTitle>
            <CardDescription>
              Select your AI-generated content and target mailing lists to send an email campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Heads up!</AlertTitle>
              <AlertDescription>
                Emails are sent on your behalf. Your account email address will be included in the `CC` field of
                each email for your records.
              </AlertDescription>
            </Alert>
            <Input
              placeholder="Campaign Name (e.g., 'Q3 Newsletter')"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
            <Select onValueChange={setSelectedContentId} value={selectedContentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Email Content..." />
              </SelectTrigger>
              <SelectContent>
                {contents.map((c) => (
                  <SelectItem key={c.id} value={c.id!}>
                    {c.contentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <Label>Target Mailing Lists</Label>
              <div className="mt-2 space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                {lists.map((list) => (
                  <div key={list.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`list-${list.id}`}
                      checked={selectedListIdsForCampaign.includes(list.id!)}
                      onCheckedChange={() => handleToggleListForCampaign(list.id!)}
                    />
                    <Label htmlFor={`list-${list.id}`} className="font-normal">
                      {list.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSendCampaign}
              disabled={
                isSending ||
                !campaignName.trim() ||
                !selectedContentId ||
                selectedListIdsForCampaign.length === 0
              }
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Campaign
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Mailing lists grid – unchanged */}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Mailing Lists</CardTitle>
            <CardDescription>Click `Manage` on a list to add or remove contacts.</CardDescription>
          </CardHeader>
          <CardContent>
            {lists.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No mailing lists created yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lists.map((list) => {
                  const contactCount = entries.filter((e) => e.mailingListIds?.includes(list.id!)).length;
                  return (
                    <Card key={list.id}>
                      <CardHeader>
                        <CardTitle>{list.name}</CardTitle>
                        <CardDescription>{list.description || 'No description'}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center text-sm font-medium">
                          <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                          {contactCount} Contact{contactCount !== 1 ? 's' : ''}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button onClick={() => handleOpenManageContacts(list)} className="w-full">
                          <Settings2 className="mr-2 h-4 w-4" />
                          Manage Contacts
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign history – unchanged */}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Campaign History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Lists</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCampaigns.map((c) => {
                      const contentName = contents.find((cnt) => cnt.id === c.contentId)?.contentName || 'N/A';
                      const listNames = c.mailingListIds
                        .map((id) => lists.find((l) => l.id === id)?.name)
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <TableRow key={c.id}>
                          <TableCell>{c.campaignName}</TableCell>
                          <TableCell>{contentName}</TableCell>
                          <TableCell>{listNames}</TableCell>
                          <TableCell>{c.status}</TableCell>
                          <TableCell>{format(new Date(c.createdAt), 'dd MMM yyyy')}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
          {campaigns.length > 0 && (
            <CardFooter className="border-t pt-2">
              <DataTablePagination
                currentPage={campaignCurrentPage}
                totalPages={campaignTotalPages}
                onPageChange={setCampaignCurrentPage}
                itemsPerPage={campaignItemsPerPage}
                onItemsPerPageChange={(value) => {
                  setCampaignItemsPerPage(value);
                  setCampaignCurrentPage(1);
                }}
                canPreviousPage={campaignCurrentPage > 1}
                canNextPage={campaignCurrentPage < campaignTotalPages}
                itemCount={campaigns.length}
                filteredItemCount={campaigns.length}
              />
            </CardFooter>
          )}
        </Card>

        {/* ── All Contacts section ── the problematic one ── */}
        <Card className="shadow-lg">
  <CardHeader>
    <CardTitle>All Contacts</CardTitle>
    <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Name, Email, Company..."
          value={contactSearchTerm}
          onChange={(e) => {
            setContactSearchTerm(e.target.value);
            setContactCurrentPage(1);
          }}
          className="pl-9"
        />
      </div>

      <Select
        onValueChange={handleContactSortChange}
        defaultValue={
          contactSortConfig ? `${contactSortConfig.key}_${contactSortConfig.direction}` : 'name_asc'
        }
      >
        <SelectTrigger className="w-full sm:w-[190px]">
          <ArrowDownUp className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name_asc">Name (A-Z)</SelectItem>
          <SelectItem value="email_asc">Email (A-Z)</SelectItem>
          <SelectItem value="createdAt_desc">Date Added</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </CardHeader>

  <CardContent className="pb-6">
    {/* ── MOBILE: Cards ── */}
    <div className="md:hidden grid gap-4 sm:gap-5">
      {paginatedContacts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No contacts found.
        </div>
      ) : (
        paginatedContacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            lists={lists}
            onEdit={handleEditContact}
            onDelete={handleDeleteContact}
            isDeleting={isDeleting}
            currentDeletingId={currentDeletingId}
          />
        ))
      )}
    </div>

    {/* ── DESKTOP: Table ── */}
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[28%]">Email</TableHead>
            <TableHead className="w-[22%]">Name</TableHead>
            <TableHead className="w-[22%]">Company</TableHead>
            <TableHead className="w-[20%]">Lists</TableHead>
            <TableHead className="w-[8%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedContacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                No contacts found.
              </TableCell>
            </TableRow>
          ) : (
            paginatedContacts.map((contact) => {
              const contactLists = lists
                .filter((l) => contact.mailingListIds?.includes(l.id!))
                .map((l) => l.name);

              return (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium max-w-[240px] truncate" title={contact.email}>
                    {contact.email}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={contact.name || '—'}>
                    {contact.name || '—'}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={contact.company || '—'}>
                    {contact.company || '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={contactLists.join(', ') || 'None'}>
                    {contactLists.length > 0 ? contactLists.join(', ') : 'None'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {/* actions buttons – same as before */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditContact(contact)}
                      disabled={isDeleting}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          disabled={isDeleting && currentDeletingId === contact.id}
                        >
                          {isDeleting && currentDeletingId === contact.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      {/* AlertDialogContent remains the same */}
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the contact <strong>{contact.email}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteContact(contact.id!, contact.email)}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isDeleting}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  </CardContent>

  {sortedAndFilteredEntries.length > 0 && (
    <CardFooter className="border-t pt-4">
      <DataTablePagination
        currentPage={contactCurrentPage}
        totalPages={contactTotalPages}
        onPageChange={setContactCurrentPage}
        itemsPerPage={contactItemsPerPage}
        onItemsPerPageChange={(v) => {
          setContactItemsPerPage(v);
          setContactCurrentPage(1);
        }}
        canPreviousPage={contactCurrentPage > 1}
        canNextPage={contactCurrentPage < contactTotalPages}
        itemCount={entries.length}
        filteredItemCount={sortedAndFilteredEntries.length}
      />
    </CardFooter>
  )}
</Card>
       
      </div>
    </>
  );
}