
'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function CostsSettingsTabContent() {
  const { control } = useFormContext();
  const { fields } = useFieldArray({
    control,
    name: "actionCosts",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Costs</CardTitle>
        <CardDescription>Set the resource point cost for various actions in the app.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map((field, index) => (
          <FormField
            key={field.id}
            control={control}
            name={`actionCosts.${index}.cost`}
            render={({ field: costField }) => (
              <FormItem>
                <FormLabel>{(field as any).label}</FormLabel>
                <FormControl><Input type="number" {...costField} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </CardContent>
    </Card>
  );
}
