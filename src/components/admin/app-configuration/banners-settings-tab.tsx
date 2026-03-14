
'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { v4 as uuidv4 } from 'uuid';

export function BannersSettingsTabContent() {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "temporaryBanners",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Temporary Banners</CardTitle>
        <CardDescription>Manage site-wide temporary banners for announcements or promotions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => {
          const isReward = watch(`temporaryBanners.${index}.isRewardBanner`);
          return (
            <div key={field.id} className="p-4 border rounded-md relative space-y-2">
              <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
              <FormField control={control} name={`temporaryBanners.${index}.title`} render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={control} name={`temporaryBanners.${index}.message`} render={({ field }) => ( <FormItem><FormLabel>Message</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={control} name={`temporaryBanners.${index}.link`} render={({ field }) => ( <FormItem><FormLabel>Link (Optional)</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={control} name={`temporaryBanners.${index}.validUntil`} render={({ field }) => ( <FormItem><FormLabel>Valid Until (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormDescription>Leave blank for banner to be always active.</FormDescription><FormMessage /></FormItem> )} />
              <div className="flex gap-4 items-center !mt-4">
                  <FormField control={control} name={`temporaryBanners.${index}.enabled`} render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormLabel>Enabled</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
                  <FormField control={control} name={`temporaryBanners.${index}.isRewardBanner`} render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormLabel>Is Reward</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
              </div>
              {isReward && (
                <FormField control={control} name={`temporaryBanners.${index}.rewardPoints`} render={({ field }) => ( <FormItem><FormLabel>Reward Points</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
              )}
            </div>
          )
        })}
        <Button type="button" variant="outline" onClick={() => append({ id: uuidv4(), enabled: true, title: '', message: '', link: '', isRewardBanner: false, rewardPoints: 0 })}>
          <PlusCircle className="mr-2 h-4 w-4" />Add Banner
        </Button>
      </CardContent>
    </Card>
  );
}
