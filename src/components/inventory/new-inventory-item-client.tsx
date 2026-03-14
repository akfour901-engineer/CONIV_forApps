
'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem, TeamPermissions } from '@/types';
import { PlusCircle, Save, Loader2, ArrowLeft, Package, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import NewInventoryItemLoadingSkeleton from '@/app/dashboard/inventory/new/loading';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { INVENTORY_ITEM_CREATION_COST } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';

const inventoryItemFormSchema = z.object({
  name: z.string().min(1, "Item name is required.").max(255),
  description: z.string().max(1000).optional().or(z.literal('')).nullable(),
  sku: z.string().max(100).optional().or(z.literal('')).nullable(),
  unitOfMeasure: z.string().min(1, "Unit of measure is required.").max(50),
  purchasePrice: z.coerce.number().min(0, "Purchase price must be non-negative.").optional().nullable(),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative."),
  quantityOnHand: z.coerce.number().int("Quantity must be a whole number.").min(0).optional().nullable(),
  lowStockThreshold: z.coerce.number().int("Threshold must be a whole number.").min(0).optional().nullable(),
  category: z.string().max(100).optional().or(z.literal('')).nullable(),
});

type InventoryItemFormValues = z.infer<typeof inventoryItemFormSchema>;

export default function NewInventoryItemPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const canManageInventory = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageInventory;

  const form = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemFormSchema),
    defaultValues: {
      name: "", description: "", sku: "", unitOfMeasure: "pcs",
      purchasePrice: null, sellingPrice: 0, quantityOnHand: null, lowStockThreshold: null, category: "",
    },
  });

  const onSubmit = async (values: InventoryItemFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canManageInventory) {
        toast({ title: "Permission Denied", description: "You do not have permission to add inventory items.", variant: "destructive"});
        return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === 'INVENTORY_ITEM_CREATION_COST')?.cost ?? INVENTORY_ITEM_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
    }

    setIsSubmitting(true);
    setGlobalIsLoading(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, dataOwnerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || 'Failed to create inventory item.');
        }
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
      }
      
      const createdItemResult: InventoryItem & { newResourcePoints?: number; cost?: number } = await response.json();
      
      if (updateGlobalUserProfile && userProfile && createdItemResult.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: createdItemResult.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }});
      }
      
      toast({ title: "Success", description: `Inventory item added successfully. Cost: ${createdItemResult.cost || 'N/A'} points.` });
      router.push('/dashboard/inventory');
    } catch (error: any) {
      console.error("Error creating inventory item (API):", error);
      toast({ title: "Error Creating Item", description: error.message, variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading && !userProfile) return <NewInventoryItemLoadingSkeleton />;
  if (!user || !userProfile) { router.push('/auth/signin'); return <NewInventoryItemLoadingSkeleton />; }
  
  if (!canManageInventory) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to add inventory items.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/inventory">Back to Inventory</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Add New Inventory Item
            </h1>
            <p className="text-muted-foreground">Enter details for a new product or service.</p>
          </div>
          <Link 
            href="/dashboard/inventory" 
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory
          </Link>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader><CardTitle>Item Details</CardTitle><CardDescription>Provide information about the inventory item.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Item Name*</FormLabel><FormControl><Input placeholder="e.g., Cement Bag (50kg), Plumbing Service (Hourly)" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Detailed description of the item..." {...field} value={field.value ?? ""} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU / Item Code</FormLabel><FormControl><Input placeholder="e.g., CEM-50, PLUMB-HR" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="e.g., Building Materials, Labour Services" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (<FormItem><FormLabel>Unit of Measure*</FormLabel><FormControl><Input placeholder="e.g., pcs, kg, mtr, hour, service" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="sellingPrice" render={({ field }) => (<FormItem><FormLabel>Selling Price (₹)*</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (<FormItem><FormLabel>Purchase Price (₹)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="quantityOnHand" render={({ field }) => (<FormItem><FormLabel>Quantity on Hand</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl><FormDescription>Leave blank if not applicable (e.g., for services).</FormDescription><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (<FormItem><FormLabel>Low Stock Threshold</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Item</>}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}
