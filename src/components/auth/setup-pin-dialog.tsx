'use client';

import { useState } from 'react';
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
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, X } from 'lucide-react';
import { SetupPinDialog } from '@/components/settings/pin-input-dialog';

interface PinDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pin: string) => void;
  isProcessing: boolean;
  showCancelButton?: boolean;
}

const pinSchema = z.object({
  pin: z.string().min(4, "PIN must be 4 digits.").max(4, "PIN must be 4 digits.").regex(/^\d{4}$/, "PIN must be 4 digits."),
  confirmPin: z.string(),
}).refine(data => data.pin === data.confirmPin, {
  message: "PINs do not match.",
  path: ["confirmPin"],
});

type PinFormValues = z.infer<typeof pinSchema>;

export default function PinSetupDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  isProcessing = false,
  showCancelButton = true
}: PinDialogProps) {
  const form = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "", confirmPin: "" },
  });

  const onSubmit = (values: PinFormValues) => {
    onConfirm(values.pin);
  };
  
  return (
    <SetupPinDialog isOpen={isOpen} onOpenChange={onOpenChange} onConfirm={onConfirm} isProcessing={isProcessing} showCancelButton={showCancelButton} />
  );
}
