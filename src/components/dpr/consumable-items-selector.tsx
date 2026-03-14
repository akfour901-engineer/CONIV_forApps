
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronsUpDown, PlusCircle, Trash2, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkOrderItem, InventoryItem, PurchaseOrderItem } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { UseFormReturn } from 'react-hook-form';
import { formatCurrency } from '@/lib/utils';

export type ConsumableItem =
  | (WorkOrderItem & {
      sourceType: 'work_order';
      sourceId: string;
      sourceName: string;
      workOrderItemId?: string;
    })
  | (InventoryItem & {
      sourceType: 'inventory';
      sourceId: string;
      sourceName: string;
    })
  | (PurchaseOrderItem & {
      sourceType: 'purchase_order';
      sourceId: string;
      sourceName: string;
    });

export type DprConsumedItem = {
  sourceType: 'work_order' | 'inventory' | 'purchase_order';
  sourceId: string;
  sourceName: string;
  workOrderItemId?: string;
  description: string;
  unit: string;
  consumedQuantity: number;
  rate: number;
  amount: number;
};
export type SvrConsumedItem = DprConsumedItem;


interface ConsumableItemsSelectorProps {
  availableItems: ConsumableItem[];
  selectedItems: DprConsumedItem[] | SvrConsumedItem[];
  onSelectionChange: (items: (DprConsumedItem | SvrConsumedItem)[]) => void;
  workOrderId?: string;
  userId?: string;
  form?: UseFormReturn<any>;
}

export default function ConsumableItemsSelector({ availableItems, selectedItems, onSelectionChange }: ConsumableItemsSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleSelectItem = (item: ConsumableItem) => {
    const isSelected = selectedItems.some(si => si.sourceId === item.id && si.sourceType === item.sourceType);
    if (isSelected) {
      onSelectionChange(selectedItems.filter(si => !(si.sourceId === item.id && si.sourceType === item.sourceType)));
    } else {
        const displayName = 'name' in item ? item.name : item.description;
        const unit = 'unit' in item ? item.unit : ('unitOfMeasure' in item ? item.unitOfMeasure : 'unit');
        const rate = 'rate' in item && item.rate !== undefined ? item.rate : 0;
      
        const newItem: DprConsumedItem = {
          sourceType: item.sourceType,
          sourceId: item.id!,
          sourceName: displayName ?? 'Unnamed Item',
          workOrderItemId: item.sourceType === 'work_order' ? item.id : undefined,
          description: displayName ?? '',
          unit: unit ?? 'nos',
          rate: rate,
          consumedQuantity: 1,
          amount: rate,
        };
      onSelectionChange([...selectedItems, newItem]);
    }
    setSearchTerm('');
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    item.consumedQuantity = newQuantity;
    item.amount = newQuantity * item.rate;
    onSelectionChange(updatedItems);
  };
  
  const handleRateChange = (index: number, newRate: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    item.rate = newRate;
    item.amount = item.consumedQuantity * newRate;
    onSelectionChange(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    onSelectionChange(updatedItems);
  };

  const filteredAvailableItems = useMemo(() => {
    return availableItems.filter(item => {
      const name = 'name' in item ? item.name : item.description;
      return name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [availableItems, searchTerm]);

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            <span className='flex items-center'><PlusCircle className="mr-2 h-4 w-4" /> Add Consumed Items...</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput 
                ref={searchInputRef}
                placeholder="Search items..." 
                value={searchTerm} 
                onValueChange={setSearchTerm} 
            />
            <CommandList>
              <CommandEmpty>No items found.</CommandEmpty>
              <CommandGroup>
                {filteredAvailableItems.map((item) => {
                  const isSelected = selectedItems.some(si => si.sourceId === item.id && si.sourceType === item.sourceType);
                  const displayName = 'name' in item ? item.name : item.description;
                  return (
                    <CommandItem
                      key={`${item.sourceType}-${item.id}`}
                      value={`${displayName}-${item.sourceId}`}
                      onSelect={() => handleSelectItem(item)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      <div className="flex-1 truncate">
                        {displayName}
                        <Badge variant="secondary" className="ml-2 capitalize text-xs">{item.sourceType.replace(/_/g, ' ')}</Badge>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ScrollArea className="h-full max-h-72 w-full pr-4">
        <div className="space-y-3">
          {selectedItems.map((selectedItem, index) => (
            <div key={index} className="flex items-start gap-2 p-3 border rounded-md relative">
              <div className="flex-1 space-y-2">
                <p className="font-semibold text-sm">{selectedItem.description}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Input type="number" value={selectedItem.consumedQuantity} onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value))} placeholder="Qty" className="text-xs h-8" />
                  <Input readOnly value={selectedItem.unit} placeholder="Unit" className="text-xs h-8 bg-muted" />
                  <Input type="number" value={selectedItem.rate} onChange={(e) => handleRateChange(index, parseFloat(e.target.value))} placeholder="Rate" className="text-xs h-8" />
                  <Input readOnly value={formatCurrency(selectedItem.amount)} placeholder="Amount" className="text-xs h-8 bg-muted font-semibold" />
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1" onClick={() => handleRemoveItem(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
