
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
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem, TeamPermissions } from '@/types';
import { Edit, Save, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import EditInventoryItemLoadingSkeleton from './loading';

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

interface EditInventoryItemPageContentProps {
  itemId: string;
}

export default function EditInventoryItemPageContent({ itemId }: EditInventoryItemPageContentProps) {
  const router = useRouter();

  const { user, userProfile, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canManageInventory = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageInventory;

  const form = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemFormSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (authLoading || !user) return;

    if (!canManageInventory) {
        toast({ title: "Permission Denied", variant: "destructive" });
        router.push('/dashboard/inventory');
        return;
    }
    
    const fetchItem = async () => {
      setIsLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/inventory/${itemId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch inventory item data.');
        const data: InventoryItem = await response.json();

        if (data.userId !== dataOwnerId) {
            toast({ title: "Access Denied", description: "You cannot edit this item.", variant: "destructive" });
            router.push('/dashboard/inventory');
            return;
        }

        setItem(data);
        form.reset({
          name: data.name,
          description: data.description || '',
          sku: data.sku || '',
          unitOfMeasure: data.unitOfMeasure,
          purchasePrice: data.purchasePrice,
          sellingPrice: data.sellingPrice,
          quantityOnHand: data.quantityOnHand,
          lowStockThreshold: data.lowStockThreshold,
          category: data.category || '',
        });
      } catch (error: any) {
        toast({ title: "Error", description: `Could not load item: ${error.message}`, variant: "destructive" });
        router.push('/dashboard/inventory');
      }
      setIsLoading(false);
    };

    fetchItem();
  }, [itemId, user, dataOwnerId, authLoading, router, toast, form, canManageInventory]);
  
  const onSubmit = async (values: InventoryItemFormValues) => {
    if (!user || !dataOwnerId || !itemId || !canManageInventory || !userProfile) {
      toast({ title: "Error", description: "User data not available.", variant: "destructive"}); return;
    }
    setIsSubmitting(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/inventory/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update item.');
      }
      
      toast({ title: "Success", description: "Inventory item updated successfully." });
      
      router.push('/dashboard/inventory');
    } catch (error: any) {
      console.error("Error updating inventory item (API):", error);
      toast({ title: "Error Updating Item", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <EditInventoryItemLoadingSkeleton />;
  if (!item) return <div className="text-center p-4">Item not found.</div>;
  if (!canManageInventory) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Permission Denied</h2>
            <p className="text-muted-foreground">You do not have permission to edit inventory items.</p>
            <Button asChild className="mt-6">
                <Link href="/dashboard/inventory">Back to Inventory</Link>
            </Button>
        </div>
      );
  }


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <Edit className="mr-3 h-7 w-7 text-primary" /> Edit Inventory Item
          </h1>
          <p className="text-muted-foreground">Modifying: {item.name}</p>
        </div>
        <Button variant="outline" asChild><Link href="/dashboard/inventory"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory</Link></Button>
      </div>

      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader><CardTitle>Item Details</CardTitle><CardDescription>Update information for this item.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Item Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU / Item Code</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (<FormItem><FormLabel>Unit of Measure*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="sellingPrice" render={({ field }) => (<FormItem><FormLabel>Selling Price (₹)*</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <FormField control={form.control} name="purchasePrice" render={({ field }) => (<FormItem><FormLabel>Purchase Price (₹)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="quantityOnHand" render={({ field }) => (<FormItem><FormLabel>Quantity on Hand</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl><FormDescription>Leave blank if not applicable (e.g., for services).</FormDescription><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (<FormItem><FormLabel>Low Stock Threshold</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : <><Save className="mr-2 h-4 w-4" /> Update Item</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
