
'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { DigitalBusinessCard, Company } from '@/types';
import { Edit, Save, Loader2, ArrowLeft, AlertTriangle, UploadCloud, Check } from 'lucide-react';
import Link from 'next/link';
import EditDigitalBusinessCardLoadingSkeleton from '@/app/dashboard/advance-tools/qr-business-card/[id]/edit/loading';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useLoading } from '@/contexts/loading-context';

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const digitalBusinessCardFormSchema = z.object({
  cardName: z.string().min(2, "Card name is required.").max(100),
  fullName: z.string().min(2, "Full name is required.").max(100),
  title: z.string().max(100).optional().or(z.literal('')),
  companyId: z.string().optional().nullable(),
  companyName: z.string().max(100).optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  website: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  linkedIn: z.string().url({ message: "Enter a valid LinkedIn URL."}).optional().or(z.literal('')),
  twitter: z.string().max(100).optional().or(z.literal('')),
  profilePictureUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Profile picture too large.").optional().nullable(),
  logoUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Logo image is too large.").optional().nullable(),
  customColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, { message: "Enter a valid hex color code, e.g., #FF5733" }).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type DigitalBusinessCardFormValues = z.infer<typeof digitalBusinessCardFormSchema>;

const COLOR_SWATCHES = [
  '#008080', '#0d47a1', '#455a64', '#b71c1c', '#1b5e20', '#4a148c', '#212121',
];

export default function EditListingClientPage({ listingId }: { listingId: string }) {
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Invalid Component</h2>
        <p className="text-muted-foreground">This component is not in use. Please check routing.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
  );
}
