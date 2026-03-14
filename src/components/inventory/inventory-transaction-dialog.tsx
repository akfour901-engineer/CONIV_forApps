'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem, WorkOrder, PurchaseOrder } from '@/types';
import { Save, Loader2, X, ArrowDown, ArrowUp, UploadCloud } from 'lucide-react';
import { Textarea } from '../ui/textarea';

interface InventoryTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  transactionType: 'issue' | 'receive';
  onTransactionComplete: () => void;
}

const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const transactionFormSchema = z.object({
  quantityChange: z.coerce.number().positive("Quantity must be a positive number."),
  workOrderId: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  unitPrice: z.coerce.number().min(0, "Price must be non-negative.").optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
  documentUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "File is too large.").optional().nullable(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export function InventoryTransactionDialog({
  isOpen,
  onOpenChange,
  item,
  transactionType,
  onTransactionComplete,
}: InventoryTransactionDialogProps) {
  const { user, dataOwnerId } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workOrderOptions, setWorkOrderOptions] = useState<ComboboxOption[]>([]);
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
  });

  const selectedPurchaseOrderId = form.watch('purchaseOrderId');

  const fetchRelatedData = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    setIsLoadingRelated(true);
    try {
      const idToken = await user.getIdToken();
      const [woResponse, poResponse] = await Promise.all([
        fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/purchase-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
      ]);
      if (woResponse.ok) {
        const woData: WorkOrder[] = await woResponse.json();
        setWorkOrderOptions(woData.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));
      }
      if (poResponse.ok) {
        const poData: PurchaseOrder[] = await poResponse.json();
        setPurchaseOrderOptions(poData.filter(po => po.status === 'ordered' || po.status === 'partially_received').map(po => ({ value: po.id!, label: `${po.poNumber} - ${po.supplierOrganizationName}` })));
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not load related Work Orders or Purchase Orders.", variant: "destructive" });
    }
    setIsLoadingRelated(false);
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchRelatedData();
      form.reset({
        quantityChange: 1,
        workOrderId: null,
        purchaseOrderId: null,
        unitPrice: transactionType === 'receive' ? item?.purchasePrice ?? 0 : null,
        remarks: "",
        documentUrl: null
      });
      setSelectedFileName(null);
    }
  }, [isOpen, fetchRelatedData, form, item, transactionType]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if(fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("documentUrl", null); setSelectedFileName(null); return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("documentUrl", reader.result as string);
        setSelectedFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  }

  const onSubmit = async (values: TransactionFormValues) => {
    if (!user || !item || !dataOwnerId) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/inventory/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, inventoryItemId: item.id, type: transactionType, dataOwnerId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to process ${transactionType} transaction.`);
      }
      toast({ title: "Success", description: `Item ${transactionType}d successfully. Check expenses/logs for details.` });
      onTransactionComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  const title = transactionType === 'issue' ? `Issue Item: ${item.name}` : `Receive Item: ${item.name}`;
  const description = transactionType === 'issue' ? `Log utilization of this item from inventory.` : `Add newly received stock to inventory.`;
  const Icon = transactionType === 'issue' ? ArrowDown : ArrowUp;
  const buttonText = transactionType === 'issue' ? 'Issue Item' : 'Receive Item';
  const buttonColor = transactionType === 'issue' ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Icon className="mr-2 h-5 w-5" />{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="text-sm p-2 bg-secondary rounded-md">
            Current Quantity on Hand: <span className="font-bold">{item.quantityOnHand ?? 'N/A'}</span>
        </div>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="inventory-transaction-form" className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="quantityChange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to {transactionType}*</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {transactionType === 'receive' && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="purchaseOrderId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Link to Purchase Order (Optional)</FormLabel>
                        <Combobox options={purchaseOrderOptions} value={field.value || ""} onChange={(val) => field.onChange(val === "" ? null : val)} placeholder="Select PO..." searchPlaceholder="Search POs..." disabled={isLoadingRelated} emptyResultText={isLoadingRelated ? "Loading..." : "No open POs."} />
                        <FormDescription>If receiving against a PO, no new expense will be logged.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!selectedPurchaseOrderId && (
                      <FormField
                          control={form.control}
                          name="unitPrice"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>Unit Purchase Price (₹)</FormLabel>
                              <FormControl>
                              <Input type="number" step="0.01" min="0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />
                              </FormControl>
                              <FormDescription>Required to log an expense if no PO is linked.</FormDescription>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                  )}
                </div>
              )}
              {transactionType === 'issue' && (
                  <FormField
                      control={form.control}
                      name="workOrderId"
                      render={({ field }) => (
                      <FormItem className="flex flex-col">
                          <FormLabel>Link to Work Order (Optional)</FormLabel>
                          <Combobox
                          options={workOrderOptions}
                          value={field.value || ""}
                          onChange={(val) => field.onChange(val === "" ? null : val)}
                          placeholder="Select Work Order..."
                          searchPlaceholder="Search..."
                          disabled={isLoadingRelated}
                          emptyResultText={isLoadingRelated ? "Loading..." : "No WOs found."}
                          />
                          <FormDescription>If issued, an expense will be logged against this WO.</FormDescription>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
              )}
                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Issued for foundation work at Site B" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel htmlFor="documentUrl">Attach Document (Optional)</FormLabel>
                  <div className="flex items-center gap-2">
                      <FormControl>
                        <Input id="documentUrl" type="file" ref={fileInputRef} onChange={handleFileChange} className="flex-1"/>
                      </FormControl>
                  </div>
                  {selectedFileName && <FormDescription>Selected: {selectedFileName}</FormDescription>}
                </FormItem>
            </form>
          </Form>
        </div>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
          <Button type="submit" form="inventory-transaction-form" disabled={isSubmitting} className={buttonColor}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Save className="mr-2 h-4 w-4" />{buttonText}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
