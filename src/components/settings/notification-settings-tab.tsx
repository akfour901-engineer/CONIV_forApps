

'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '../ui/label';

const notificationItems = [
    { id: 'workOrderStatusAlerts', label: 'Work Order Status Alerts', description: 'Notifications for changes in your work order statuses.' },
    { id: 'weeklyInvoiceFollowups', label: 'Weekly Invoice Follow-ups', description: 'Weekly reminders for unpaid or overdue invoices.' },
    { id: 'weeklySecurityDepositFollowups', label: 'Weekly Security Deposit Follow-ups', description: 'Weekly reminders for security deposits due for return.' },
    { id: 'weeklyFinancialSummary', label: 'Weekly Financial Summary', description: 'Receive a weekly summary of your financial performance.' },
    { id: 'weeklyLicensesDue', label: 'Weekly Licenses Due', description: 'A weekly summary of licenses that are due for renewal.' },
    { id: 'weeklyTopAlerts', label: 'Weekly Top Alerts', description: 'Receive a weekly email digest of the most important alerts.' },
    { id: 'marketplaceUpdates', label: 'Marketplace Updates', description: 'Notifications about new listings or messages in the marketplace.' },
    { id: 'newLoginAlerts', label: 'New Login Alerts', description: 'Get an alert when a login occurs from a new device or location.' },
    { id: 'largeExpenseAlerts', label: 'Large Expense Alerts', description: 'Be notified when an expense is logged over a certain threshold.' },
    { id: 'projectBudgetWatch', label: 'Project Budget Watch', description: 'Alerts when a project\'s expenses exceed 80% of its budget.' },
    { id: 'profitabilityDipAlerts', label: 'Profitability Dip Alerts', description: 'Notifications when a project\'s profit margin falls below a set threshold.' },
] as const;

const dayOptions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


interface NotificationSettingsTabContentProps {
  form: any; // The form instance from react-hook-form
}

export function NotificationSettingsTabContent({ form }: NotificationSettingsTabContentProps) {
    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage your email and in-app notification settings. Changes must be saved using the `Save All Preferences` button at the bottom of the page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <FormField
                    control={form.control}
                    name="notifications.preferredDigestDay"
                    render={({ field }) => (
                        <FormItem className="rounded-lg border p-4">
                            <FormLabel className="text-base">Weekly Digest Day</FormLabel>
                            <FormDescription>
                                Choose which day of the week you`d like to receive your weekly summary emails.
                            </FormDescription>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a day" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {dayOptions.map(day => (
                                    <SelectItem key={day} value={day}>{day}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {notificationItems.map((item) => (
                    <FormField
                    key={item.id}
                    control={form.control}
                    name={`notifications.${item.id}`}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">{item.label}</FormLabel>
                                <FormDescription>{item.description}</FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

    
