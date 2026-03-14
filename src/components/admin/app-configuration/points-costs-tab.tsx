// src/components/admin/app-configuration/points-costs-tab.tsx
'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface PointsCostsTabProps {
  form: UseFormReturn<any>;
}

export function PointsCostsTab({ form }: PointsCostsTabProps) {
  const { fields } = useFieldArray({
    control: form.control,
    name: 'actionCosts',
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {fields.map((field, index) => (
        <FormField
          key={field.id}
          control={form.control}
          name={`actionCosts.${index}.cost`}
          render={({ field: fieldProps }) => (
            <FormItem>
              <FormLabel>{form.getValues(`actionCosts.${index}.label`)}</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter cost" {...fieldProps} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
