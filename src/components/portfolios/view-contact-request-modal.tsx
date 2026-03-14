
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PortfolioContact } from '@/types';
import { Mail, Phone, User, MessageSquare, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ViewContactRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contact: PortfolioContact | null;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try { return format(parseISO(dateString), 'dd MMM yyyy, p'); }
  catch (e) { return 'Invalid Date'; }
};

export default function ViewContactRequestModal({ isOpen, onOpenChange, contact }: ViewContactRequestModalProps) {
  if (!contact) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact Request from {contact.name}</DialogTitle>
          <DialogDescription>
            Received on: {formatDate(contact.createdAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 text-sm">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Name:</span>
            <span>{contact.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Email:</span>
            <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
          </div>
          {contact.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Phone:</span>
              <a href={`tel:${contact.phone}`} className="text-primary hover:underline">{contact.phone}</a>
            </div>
          )}
          <div className="flex items-start gap-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-1" />
            <div>
              <p className="font-semibold">Message:</p>
              <p className="mt-1 whitespace-pre-wrap bg-secondary/50 p-3 rounded-md">{contact.message}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
