// src/components/admin/app-configuration/legal-content-tab.tsx
'use client';

import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import type { UseFormReturn } from 'react-hook-form';

interface LegalContentTabProps {
  form: UseFormReturn<any>;
}

export function LegalContentTab({ form }: LegalContentTabProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="termsAndConditionsContent"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Terms and Conditions</FormLabel>
            <FormControl>
              <Textarea placeholder="Enter your Terms and Conditions content here..." {...field} rows={15} />
            </FormControl>
            <FormDescription>
              This content will be displayed on the public legal page for Terms and Conditions. Use Markdown for formatting.
            </FormDescription>
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
              <Textarea placeholder="Enter your Privacy Policy content here..." {...field} rows={15} />
            </FormControl>
             <FormDescription>
              This content will be displayed on the public legal page for Privacy Policy. Use Markdown for formatting.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
