
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { UseFormReturn } from 'react-hook-form';
import { useFieldArray } from "react-hook-form";
import { Trash2, PlusCircle } from 'lucide-react';

interface CoinPackagesTabProps {
  form: UseFormReturn<any>;
}

export function CoinPackagesTab({ form }: CoinPackagesTabProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "coinPurchasePackages",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coin Purchase Packages</CardTitle>
        <CardDescription>Configure the packages users can purchase to get more resource points.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="p-4 border rounded-md space-y-3 relative">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Package #{index + 1}</h4>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <FormField control={form.control} name={`coinPurchasePackages.${index}.name`} render={({ field: fieldProps }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...fieldProps} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name={`coinPurchasePackages.${index}.description`} render={({ field: fieldProps }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...fieldProps} /></FormControl><FormMessage /></FormItem>
            )}/>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name={`coinPurchasePackages.${index}.amount`} render={({ field: fieldProps }) => (
                <FormItem><FormLabel>Amount (INR)</FormLabel><FormControl><Input type="number" {...fieldProps} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name={`coinPurchasePackages.${index}.points`} render={({ field: fieldProps }) => (
                <FormItem><FormLabel>Points Awarded</FormLabel><FormControl><Input type="number" {...fieldProps} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ id: `pack_${Date.now()}`, name: '', amount: 0, points: 0, description: '' })}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Package
        </Button>
      </CardContent>
    </Card>
  );
}
