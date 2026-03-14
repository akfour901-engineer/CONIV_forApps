
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, MailWarning, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { Invoice, SmartCollectionsOutput, FollowUpDraft } from '@/types/server-only';
import AiSmartCollectionsLoading from './loading';
import { Separator } from '@/components/ui/separator';

export default function AiSmartCollectionsClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<FollowUpDraft | null>(null);
    const [invoices, setInvoices] = useState<ComboboxOption[]>([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewInvoices;

    useEffect(() => {
        if (user && dataOwnerId) {
            const fetchInvoices = async () => {
                setIsLoadingInvoices(true);
                try {
                    const idToken = await user.getIdToken();
                    const response = await fetch(`/api/invoices?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
                    if (!response.ok) throw new Error("Failed to fetch invoices.");
                    const data: Invoice[] = await response.json();
                    const overdueInvoices = data.filter(inv => ['overdue', 'partially-paid', 'unpaid', 'sent'].includes(inv.status));
                    setInvoices(overdueInvoices.map(inv => ({ value: inv.id!, label: `${inv.invoiceNumber} - ${inv.organizationName}` })));
                } catch (e: any) {
                    toast({ title: "Error", description: `Could not load invoices: ${e.message}`, variant: "destructive" });
                } finally {
                    setIsLoadingInvoices(false);
                }
            };
            fetchInvoices();
        }
    }, [user, dataOwnerId, toast]);

    const handleAnalyze = async () => {
        if (!selectedInvoiceId) {
            toast({ title: "Selection Required", description: "Please select an invoice.", variant: "destructive" });
            return;
        }
        if (!user || !userProfile || !dataOwnerId) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/smart-collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, invoiceId: selectedInvoiceId, actorUid: user.uid, actorName: userProfile.fullName }),
            });
            const result: SmartCollectionsOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to generate follow-up.');

            setAnalysisResult(result.draft);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                if(userProfile) {
                    updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
                }
            }
            toast({ title: "Draft Complete", description: "Your AI-generated follow-up is ready." });
        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if(authLoading || isLoadingInvoices) return <AiSmartCollectionsLoading />;

    if(!canAccessTool) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to use this tool.</p>
                 <Button asChild className="mt-6"><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><MailWarning className="mr-3 h-7 w-7 text-primary" />AI Smart Collections Agent</h1>
                    <p className="text-muted-foreground">Let AI draft professional follow-up emails for your overdue invoices.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generate Follow-up Email</CardTitle>
                    <CardDescription>Select an overdue invoice to generate a polite and professional follow-up email.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Combobox options={invoices} value={selectedInvoiceId} onChange={setSelectedInvoiceId} placeholder={isLoadingInvoices ? "Loading invoices..." : "Select an overdue invoice..."} searchPlaceholder="Search invoices..." disabled={isLoadingInvoices} />
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || !selectedInvoiceId}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Drafting Email...</> : <><Bot className="mr-2 h-4 w-4" />Generate Draft</>}
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Generated Email Draft</CardTitle>
                        <CardDescription>You can copy this content and send it to your client.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div>
                            <h4 className="font-semibold text-primary mb-1">Suggested Subject</h4>
                            <p className="text-sm font-medium bg-secondary/50 p-3 rounded-md">{analysisResult.subject}</p>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-primary mb-1">Suggested Body</h4>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap border p-3 rounded-md bg-secondary/50">{analysisResult.body}</div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
