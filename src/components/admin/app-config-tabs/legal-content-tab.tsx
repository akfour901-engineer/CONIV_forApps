
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

export function LegalContentTab({ form }: { form: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal Document Content</CardTitle>
        <CardDescription>
          Edit the content for your Terms and Conditions and Privacy Policy. These will be displayed on the public-facing legal pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="termsAndConditionsContent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Terms and Conditions</FormLabel>
              <FormControl>
                <Textarea {...field} rows={15} placeholder="Enter your full Terms and Conditions text here..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="privacyPolicyContent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Privacy Policy</FormLabel>
              <FormControl>
                <Textarea {...field} rows={15} placeholder="Enter your full Privacy Policy text here..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
