
'use client';

import { useForm, useFieldArray, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2 } from "lucide-react";
import type { AppConfigActionCost, AppConfigCoinPurchasePackage, AppConfiguration, SystemEmails, SocialLinks } from "@/types";
import { Separator } from "../ui/separator";

interface AppConfigFormProps {
    form: ReturnType<typeof useForm<any>>;
}

export function AppConfigForm({ form }: AppConfigFormProps) {
    const { fields: actionCostFields, append: appendActionCost, remove: removeActionCost } = useFieldArray({ control: form.control, name: "actionCosts" });
    const { fields: packageFields, append: appendPackage, remove: removePackage } = useFieldArray({ control: form.control, name: "coinPurchasePackages" });

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Core Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField name="appName" control={form.control} render={({ field }) => (<FormItem><FormLabel>App Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField name="defaultSignupResourcePoints" control={form.control} render={({ field }) => (<FormItem><FormLabel>Default Signup Resource Points</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField name="supportContactPhone" control={form.control} render={({ field }) => (<FormItem><FormLabel>Support Contact Phone</FormLabel><FormControl><Input {...field} placeholder="+91..." /></FormControl><FormDescription>A public phone number for support inquiries.</FormDescription><FormMessage /></FormItem>)} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>App Download Links</CardTitle><CardDescription>Provide direct download links for your installable applications.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <FormField name="desktopAppUrl" control={form.control} render={({ field }) => (<FormItem><FormLabel>Desktop App URL (e.g., Windows .exe)</FormLabel><FormControl><Input {...field} placeholder="https://storage.googleapis.com/..." /></FormControl><FormMessage /></FormItem>)} />
                    <FormField name="mobileAppUrl" control={form.control} render={({ field }) => (<FormItem><FormLabel>Mobile App URL (e.g., Android .apk)</FormLabel><FormControl><Input {...field} placeholder="https://storage.googleapis.com/..." /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Action Costs</CardTitle><CardDescription>Set the resource point cost for various actions in the app.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    {actionCostFields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                            <FormField name={`actionCosts.${index}.label`} control={form.control} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Action Label</FormLabel><FormControl><Input {...field} readOnly /></FormControl></FormItem>)} />
                            <FormField name={`actionCosts.${index}.cost`} control={form.control} render={({ field }) => (<FormItem className="w-24"><FormLabel>Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Coin Purchase Packages</CardTitle><CardDescription>Define the packages users can buy.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    {packageFields.map((field, index) => (
                        <div key={field.id} className="p-3 border rounded-md space-y-2">
                             <div className="flex justify-between items-center"><h4 className="font-medium">Package #{index + 1}</h4><Button type="button" variant="ghost" size="icon" onClick={() => removePackage(index)}><Trash2 className="h-4 w-4" /></Button></div>
                             <FormField name={`coinPurchasePackages.${index}.id`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Package ID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                             <FormField name={`coinPurchasePackages.${index}.name`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                             <FormField name={`coinPurchasePackages.${index}.amount`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Amount (INR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                             <FormField name={`coinPurchasePackages.${index}.points`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Points</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                             <FormField name={`coinPurchasePackages.${index}.description`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => appendPackage({ id: `pack_${Date.now()}`, name: '', amount: 0, points: 0, description: '' })}><PlusCircle className="mr-2 h-4 w-4" />Add Package</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Legal Content</CardTitle><CardDescription>Edit the content for your legal pages.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <FormField name="termsAndConditionsContent" control={form.control} render={({ field }) => (<FormItem><FormLabel>Terms and Conditions</FormLabel><FormControl><Textarea {...field} rows={15} /></FormControl><FormDescription>Enter the full text content for your T&C page.</FormDescription><FormMessage /></FormItem>)} />
                    <Separator />
                    <FormField name="privacyPolicyContent" control={form.control} render={({ field }) => (<FormItem><FormLabel>Privacy Policy</FormLabel><FormControl><Textarea {...field} rows={15} /></FormControl><FormDescription>Enter the full text content for your Privacy Policy page.</FormDescription><FormMessage /></FormItem>)} />
                </CardContent>
            </Card>
        </div>
    );
}

    