
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { SectionTemplate } from "./section-templates";

interface AddSectionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSectionSelect: (template: SectionTemplate) => void;
  sectionTemplates: SectionTemplate[];
}

export function AddSectionModal({ isOpen, onOpenChange, onSectionSelect, sectionTemplates }: AddSectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a New Section</DialogTitle>
          <DialogDescription>
            Choose a pre-designed section to add to your portfolio page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
          {sectionTemplates.map((template) => (
            <Card key={template.name} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </CardContent>
              <CardContent>
                <Button onClick={() => onSectionSelect(template)} className="w-full">
                  Add Section
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
