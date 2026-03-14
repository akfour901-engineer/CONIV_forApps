
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Loader2, AlertTriangle, Timer, BookUser, FileSignature } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LegalDocumentModal } from '@/components/legal/legal-document-modal';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { type UseFormReturn } from 'react-hook-form';

interface DataPrivacyTabContentProps {
    exportFormat: 'json' | 'csv';
    setExportFormat: (format: 'json' | 'csv') => void;
    handleDataExport: () => void;
    handleAccountDeletionRequest: () => void;
    isRequestingExport: boolean;
    isDeletingAccount: boolean;
    form: UseFormReturn<any>;
}

export function DataPrivacyTabContent({
    exportFormat,
    setExportFormat,
    handleDataExport,
    handleAccountDeletionRequest,
    isRequestingExport,
    isDeletingAccount,
    form
}: DataPrivacyTabContentProps) {
    
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

    return (
        <>
            <LegalDocumentModal
                isOpen={isTermsModalOpen}
                onOpenChange={setIsTermsModalOpen}
                title="Terms and Conditions"
                contentType="termsAndConditionsContent"
            />
            <LegalDocumentModal
                isOpen={isPrivacyModalOpen}
                onOpenChange={setIsPrivacyModalOpen}
                title="Privacy Policy"
                contentType="privacyPolicyContent"
            />
            <div className="space-y-6">
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle>Usage Analytics</CardTitle>
                        <CardDescription>Control how your application usage data is handled. Changes must be saved using the `Save All Preferences` button at the bottom of the page.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="logActiveTime"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Log Active Application Time</FormLabel>
                                        <p className="text-sm text-muted-foreground">
                                            Allow the system to log your active time in the application to help us improve performance and user experience.
                                        </p>
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
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle>Data Export</CardTitle>
                        <CardDescription>Export a copy of all your data associated with your account.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                        <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as 'json' | 'csv')}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="json">JSON</SelectItem>
                                <SelectItem value="csv">CSV (Zipped)</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleDataExport} disabled={isRequestingExport} className="w-full sm:w-auto">
                            {isRequestingExport ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</> : <><Download className="mr-2 h-4 w-4" /> Export My Data</>}
                        </Button>
                    </CardContent>
                </Card>
                
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <BookUser className="mr-2 h-5 w-5" /> Legal Documents
                        </CardTitle>
                        <CardDescription>
                            Review our terms of service and privacy policy.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4">
                         <Button onClick={() => setIsTermsModalOpen(true)} variant="outline">
                            <FileSignature className="mr-2 h-4 w-4" /> View Terms & Conditions
                        </Button>
                        <Button onClick={() => setIsPrivacyModalOpen(true)} variant="outline">
                           <FileSignature className="mr-2 h-4 w-4" /> View Privacy Policy
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center">
                            <AlertTriangle className="mr-2 h-5 w-5" /> Danger Zone
                        </CardTitle>
                        <CardDescription>
                            Be careful with these actions as they are irreversible.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border border-destructive/20 rounded-md bg-destructive/5">
                            <div>
                                <h4 className="font-semibold text-destructive">Delete Your Account</h4>
                                <p className="text-sm text-destructive/90">This will permanently delete your account and all associated data.</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full mt-2 sm:mt-0 sm:w-auto" disabled={isDeletingAccount}>
                                        {isDeletingAccount ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Trash2 className="mr-2 h-4 w-4" />Request Account Deletion</>}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action is irreversible. All your data, including companies, projects, invoices, and user information, will be permanently deleted. This cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleAccountDeletionRequest} className="bg-destructive hover:bg-destructive/90">
                                            I understand, delete my account
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
