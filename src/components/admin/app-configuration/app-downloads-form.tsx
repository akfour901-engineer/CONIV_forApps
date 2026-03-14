
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Download, AppWindow, Smartphone } from "lucide-react";

export function AppDownloadsForm({ form }: { form: any }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Download className="mr-2 h-5 w-5" /> App Downloads
                </CardTitle>
                <CardDescription>
                    Provide direct download links for your installable desktop and mobile applications.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="desktopAppUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><AppWindow className="mr-2 h-4 w-4" /> Windows App URL (.exe)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://your-storage.com/app.exe" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormDescription>The public URL where users can download the Windows application.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="mobileAppUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><Smartphone className="mr-2 h-4 w-4" /> Android App URL (.apk)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://your-storage.com/app.apk" {...field} value={field.value || ''} />
                            </FormControl>
                             <FormDescription>The public URL where users can download the Android application.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    );
}
