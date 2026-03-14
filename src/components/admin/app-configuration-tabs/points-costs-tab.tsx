
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { UseFormReturn } from 'react-hook-form';
import { useFieldArray } from "react-hook-form";

interface PointsCostsTabProps {
  form: UseFormReturn<any>;
}

export function PointsCostsTab({ form }: PointsCostsTabProps) {
  const { fields } = useFieldArray({
    control: form.control,
    name: "actionCosts",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Costs</CardTitle>
        <CardDescription>Define how many resource points each action costs. Set to 0 to make an action free.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map((field, index) => (
            <FormField
              key={field.id}
              control={form.control}
              name={`actionCosts.${index}.cost`}
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>{form.getValues(`actionCosts.${index}.label`)}</FormLabel>
                  <FormControl><Input type="number" {...fieldProps} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
