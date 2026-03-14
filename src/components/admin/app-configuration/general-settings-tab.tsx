// src/components/admin/app-configuration/general-settings-tab.tsx
'use client';

import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_SIGNUP_RESOURCE_POINTS } from '@/lib/constants';
import type { UseFormReturn } from 'react-hook-form';

interface GeneralSettingsTabProps {
  form: UseFormReturn<any>;
}

export function GeneralSettingsTab({ form }: GeneralSettingsTabProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="appName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>App Name</FormLabel>
            <FormControl>
              <Input placeholder="CONIV" {...field} />
            </FormControl>
            <FormDescription>The public name of the application.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="defaultSignupResourcePoints"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Default Signup Points</FormLabel>
            <FormControl>
              <Input type="number" placeholder={String(DEFAULT_SIGNUP_RESOURCE_POINTS)} {...field} />
            </FormControl>
            <FormDescription>The number of resource points a new user gets upon signing up.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="razorpayKeyId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Razorpay Key ID</FormLabel>
            <FormControl>
              <Input placeholder="rzp_test_..." {...field} value={field.value || ''} />
            </FormControl>
            <FormDescription>Your Razorpay Key ID for processing payments.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
        <FormField
            control={form.control}
            name="defaultSorVisibility"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Default SOR Visibility</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select default visibility" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="public">Public</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormDescription>
                        Set the default visibility for newly created SOR items.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    </div>
  );
}
