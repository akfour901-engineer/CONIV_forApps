
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function AppDownloadsTab({ form }: { form: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>App Download Links</CardTitle>
        <CardDescription>
          Provide the direct download URLs for your installable application files. If a URL is not provided, the download button for that platform will be hidden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="mobileAppUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Android App URL (.apk)</FormLabel>
              <FormControl>
                <Input placeholder="https://your-storage.com/app.apk" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="desktopAppUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Desktop App URL (.exe)</FormLabel>
              <FormControl>
                <Input placeholder="https://your-storage.com/app.exe" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
