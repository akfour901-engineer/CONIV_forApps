
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, X, Users } from 'lucide-react';
import type { MailingListEntry, MailingList } from '@/types';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { InsufficientPointsDialog } from '../dashboard/insufficient-points-dialog';
import { MAILING_LIST_MEMBERSHIP_COST } from '@/lib/constants';

interface ManageListContactsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  list: MailingList | null;
  allContacts: MailingListEntry[];
}

export function ManageListContactsDialog({ isOpen, onOpenChange, onUpdate, list, allContacts }: ManageListContactsDialogProps) {
  const { user, dataOwnerId, userProfile, appConfig, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  useEffect(() => {
    if (list && isOpen) {
      const initialSelected = allContacts
        .filter(c => c.mailingListIds?.includes(list.id!))
        .map(c => c.id!);
      setSelectedContactIds(new Set(initialSelected));
    } else {
        setSelectedContactIds(new Set());
    }
  }, [list, allContacts, isOpen]);

  const filteredContacts = useMemo(() => {
    return allContacts.filter(c => 
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a,b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [allContacts, searchTerm]);

  const handleToggleContact = (contactId: string) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!user || !dataOwnerId || !list || !userProfile || !appConfig) return;

    setIsSubmitting(true);

    let newAdditionsCount = 0;
    
    // Calculate cost based on new additions only
    allContacts.forEach(contact => {
        const isCurrentlyInList = contact.mailingListIds?.includes(list.id!) ?? false;
        const shouldBeInList = selectedContactIds.has(contact.id!);
        if (shouldBeInList && !isCurrentlyInList) {
            newAdditionsCount++;
        }
    });

    const costPerAddition = appConfig?.actionCosts?.find(c => c.key === 'MAILING_LIST_MEMBERSHIP_COST')?.cost ?? MAILING_LIST_MEMBERSHIP_COST;
    const totalCost = newAdditionsCount * costPerAddition;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (totalCost > 0 && currentPoints < totalCost) {
        setPointsInfo({ required: totalCost, current: currentPoints });
        setIsPointsDialogOpen(true);
        setIsSubmitting(false);
        return;
    }

    try {
      const idToken = await user.getIdToken();
      const updates = allContacts
        .filter(contact => {
          const isCurrentlyInList = contact.mailingListIds?.includes(list.id!) ?? false;
          const shouldBeInList = selectedContactIds.has(contact.id!);
          return isCurrentlyInList !== shouldBeInList;
        })
        .map(contact => {
          const shouldBeInList = selectedContactIds.has(contact.id!);
          const newListIds = shouldBeInList
                ? [...(contact.mailingListIds || []), list.id!]
                : contact.mailingListIds?.filter(id => id !== list.id!) || [];

          return fetch(`/api/marketing/mailing-list-entries/${contact.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
              body: JSON.stringify({ mailingListIds: newListIds, dataOwnerId: dataOwnerId }), // Passing dataOwnerId for cost deduction context
          });
        });
        
      const responses = await Promise.all(updates);
      const failed = responses.filter(res => !res.ok);
      
      if (failed.length > 0) {
        throw new Error(`${failed.length} contacts could not be updated.`);
      }

      toast({ title: "Success", description: "Mailing list members updated." });
      
      if (totalCost > 0 && updateGlobalUserProfile && dataOwnerId === user.uid) {
         updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: currentPoints - totalCost } });
      }
      
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!list) return null;

  return (
     <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center"><Users className="mr-2 h-5 w-5"/>Manage Contacts in `{list.name}`</DialogTitle>
            <DialogDescription>Select the contacts you want to include in this list.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            <ScrollArea className="h-64 w-full rounded-md border p-4">
              {filteredContacts.length > 0 ? filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center space-x-3 mb-2">
                  <Checkbox
                    id={`contact-${contact.id}`}
                    checked={selectedContactIds.has(contact.id!)}
                    onCheckedChange={() => handleToggleContact(contact.id!)}
                  />
                  <label htmlFor={`contact-${contact.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {contact.name || contact.email} <span className="text-xs text-muted-foreground">{contact.name && `<${contact.email}>`}</span>
                  </label>
                </div>
              )) : <p className="text-sm text-center text-muted-foreground">No contacts found.</p>}
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save Changes</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
     </>
  );
}
