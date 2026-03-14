
'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export function PackagesSettingsTabContent() {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "coinPurchasePackages",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coin Purchase Packages</CardTitle>
        <CardDescription>Define the packages users can buy to get more resource points.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="p-4 border rounded-md relative space-y-2">
             <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
            <FormField control={control} name={`coinPurchasePackages.${index}.name`} render={({ field }) => ( <FormItem><FormLabel>Package Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={control} name={`coinPurchasePackages.${index}.amount`} render={({ field }) => ( <FormItem><FormLabel>Amount (INR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={control} name={`coinPurchasePackages.${index}.points`} render={({ field }) => ( <FormItem><FormLabel>Points Awarded</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
            </div>
            <FormField control={control} name={`coinPurchasePackages.${index}.description`} render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem> )} />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => append({ id: `pack_new_${Date.now()}`, name: '', amount: 0, points: 0, description: '' })}>
          <PlusCircle className="mr-2 h-4 w-4" />Add Package
        </Button>
      </CardContent>
    </Card>
  );
}
