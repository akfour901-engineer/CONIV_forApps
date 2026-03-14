
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, ShieldCheck, AlertTriangle, Filter } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import type { Company } from '@/types/server-only';
import { WORK_ORDER_STATUS_OPTIONS, INVOICE_STATUS_OPTIONS, ESTIMATE_STATUS_OPTIONS } from '@/types/server-only';
import AuditLoadingSkeleton from '@/app/dashboard/advance-tools/audit/loading';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { auditContractorActivities } from '@/ai/flows/audit-contractor-activities-flow';
import type { AuditContractorActivitiesInput, AuditContractorActivitiesOutput } from '@/ai/flows/audit-contractor-activities-flow';

export default function AuditClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<AuditContractorActivitiesOutput, 'newResourcePoints'> | null>(null);
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
    
    // Form state
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [industryBenchmarks, setIndustryBenchmarks] = useState('');
    const [economicData, setEconomicData] = useState('');
    const [woStatusFilter, setWoStatusFilter] = useState('all');
    const [invStatusFilter, setInvStatusFilter] = useState('all');
    const [estStatusFilter, setEstStatusFilter] = useState('all');
    const [sdFilter, setSdFilter] = useState('all');
    const [licenseFilter, setLicenseFilter] = useState('all');

    const canRunAudits = isViewingOwnAccount || !!currentTeamMemberPermissions?.canRunAudits;

    useEffect(() => {
        if (user && dataOwnerId) {
            const fetchCompanies = async () => {
                setIsLoadingCompanies(true);
                try {
                    const idToken = await user.getIdToken();
                    const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
                    if (!response.ok) throw new Error("Failed to fetch companies.");
                    const data: Company[] = await response.json();
                    setCompanies(data.map(c => ({ value: c.id!, label: c.name })));
                } catch (e: any) {
                    toast({ title: "Error", description: `Could not load companies: ${e.message}`, variant: "destructive" });
                } finally {
                    setIsLoadingCompanies(false);
                }
            };
            fetchCompanies();
        }
    }, [user, dataOwnerId, toast]);

    const handleAnalyze = async () => {
        if (!selectedCompanyId) {
            toast({ title: "Selection Required", description: "Please select a company to audit.", variant: "destructive" });
            return;
        }
        if (!user || !userProfile || !dataOwnerId) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        
        const auditInput: AuditContractorActivitiesInput = {
            companyId: selectedCompanyId,
            industryBenchmarks: industryBenchmarks || 'Not provided',
            economicData: economicData || 'Not provided',
            workOrderStatusFilter: woStatusFilter === 'all' ? undefined : woStatusFilter,
            invoiceStatusFilter: invStatusFilter === 'all' ? undefined : invStatusFilter,
            estimateStatusFilter: estStatusFilter === 'all' ? undefined : estStatusFilter,
            sdFilter: sdFilter as 'all' | 'with_sd' | 'without_sd',
            licenseFilter: licenseFilter as 'all' | 'expiring_soon',
            userId: dataOwnerId,
            actorUid: user.uid,
            actorName: userProfile.fullName ?? undefined,
        };

        try {
             const result = await auditContractorActivities(auditInput);
            if (result.error) {
                throw new Error(result.error);
            }
            
            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Audit Complete", description: "Your company audit report is ready." });
        } catch (error: any) {
            toast({ title: "Audit Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (authLoading) return <AuditLoadingSkeleton />;
    if (!canRunAudits) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to run audits.</p>
                <Button asChild className="mt-6"><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><ShieldCheck className="mr-3 h-7 w-7 text-primary" />AI Audit Tool</h1>
                    <p className="text-muted-foreground">Analyze company data for errors and inconsistencies.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Audit Configuration</CardTitle>
                    <CardDescription>Select a company and provide optional context for a more accurate audit.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Combobox options={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} placeholder="Select Company to Audit..." searchPlaceholder="Search companies..." disabled={isLoadingCompanies} />
                    
                    <div className="grid md:grid-cols-2 gap-4">
                        <Textarea placeholder="Optional: Provide industry benchmarks (e.g., average profit margin is 15%, material costs have risen 10% this quarter)." value={industryBenchmarks} onChange={(e) => setIndustryBenchmarks(e.target.value)} rows={3} />
                        <Textarea placeholder="Optional: Provide relevant economic data (e.g., current inflation rate is 5%, diesel price is ₹90/litre)." value={economicData} onChange={(e) => setEconomicData(e.target.value)} rows={3} />
                    </div>

                    <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center"><Filter className="h-4 w-4 mr-2"/>Optional Filters</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                           <div><Label>Work Orders</Label><Select value={woStatusFilter} onValueChange={setWoStatusFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{WORK_ORDER_STATUS_OPTIONS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                           <div><Label>Invoices</Label><Select value={invStatusFilter} onValueChange={setInvStatusFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{INVOICE_STATUS_OPTIONS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                           <div><Label>Estimates</Label><Select value={estStatusFilter} onValueChange={setEstStatusFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{ESTIMATE_STATUS_OPTIONS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                           <div><Label>Security Deposit</Label><Select value={sdFilter} onValueChange={setSdFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="with_sd">With SD</SelectItem><SelectItem value="without_sd">Without SD</SelectItem></SelectContent></Select></div>
                           <div><Label>Licenses</Label><Select value={licenseFilter} onValueChange={setLicenseFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="expiring_soon">Expiring Soon</SelectItem></SelectContent></Select></div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || !selectedCompanyId}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Auditing...</> : <><Bot className="mr-2 h-4 w-4" />Run Audit</>}
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Audit Report</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-primary mb-1">AI Audit Summary</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.auditSummary}</p>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-green-600 mb-2">Suggested Corrections</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.suggestedCorrections}</p>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-destructive mb-2">Risk Assessment</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.riskAssessment}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
