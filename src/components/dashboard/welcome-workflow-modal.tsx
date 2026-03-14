
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { WorkflowGraph } from '@/components/workflow/workflow-graph';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

export function WelcomeWorkflowModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the modal has been shown in this session
    const hasBeenShown = sessionStorage.getItem('welcomeModalShown');
    if (!hasBeenShown) {
      // If not shown, open the modal and set the flag
      setIsOpen(true);
      sessionStorage.setItem('welcomeModalShown', 'true');
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl w-[95vw] h-auto max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Welcome! Here`s Your Business Workflow</DialogTitle>
          <DialogDescription>
            This graph shows how the different parts of the application connect to help you manage your projects from start to finish. You can always find this guide again under `Account & Settings`.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="py-4">
                <WorkflowGraph />
            </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button onClick={handleClose}>Got it, let`s get started!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
