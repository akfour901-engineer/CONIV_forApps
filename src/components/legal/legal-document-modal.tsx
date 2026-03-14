
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from "../ui/skeleton";
import { X, FileText } from 'lucide-react';
import React from 'react';

interface LegalDocumentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  contentType: 'termsAndConditionsContent' | 'privacyPolicyContent';
}

export function LegalDocumentModal({
  isOpen,
  onOpenChange,
  title,
  contentType,
}: LegalDocumentModalProps) {
  const { appConfig, loading: authLoading } = useAuth();
  const [content, setContent] = React.useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = React.useState(true);

  React.useEffect(() => {
    if (isOpen && appConfig) {
      setContent(appConfig[contentType] || null);
      setIsLoadingContent(false);
    } else if (isOpen) {
      setIsLoadingContent(true);
    }
  }, [isOpen, appConfig, contentType]);
  
  // Ensure content is a string before calling replace, or default to an empty string.
  const formattedContent = (content || '').replace(/\\n/g, "\n").replace(/\n/g, "<br />");
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-full flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5"/> {title}
          </DialogTitle>
          <DialogDescription>
            Please review the {title.toLowerCase()} for our services.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6 border-y">
          <div className="py-4">
            {isLoadingContent || authLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : content ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: formattedContent }}
              />
            ) : (
              <p>Content not available.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
