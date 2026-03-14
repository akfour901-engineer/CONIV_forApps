
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import AiFinancialHealthCheckLoading from '@/app/dashboard/advance-tools/ai-financial-health-check/loading';
import type { Company, HealthCheckOutput } from '@/types/server-only';
import { Separator } from '@/components/ui/separator';

export default function AiFinancialHealthCheckClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<HealthCheckOutput, 'newResourcePoints'> | null>(null);
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewFinancialSummaries;

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
            toast({ title: "Selection Required", description: "Please select a company to analyze.", variant: "destructive" });
            return;
        }
        if (!user || !userProfile || !dataOwnerId) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/financial-health-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, companyId: selectedCompanyId, actorUid: user.uid, actorName: userProfile.fullName ?? undefined }),
            });
            const result: HealthCheckOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to get financial analysis.');
            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                if(userProfile){
                     updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
                }
            }
            toast({ title: "Analysis Complete", description: "Financial health check report is ready." });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if (authLoading) return <AiFinancialHealthCheckLoading />;

    if (!canAccessTool) {
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
                    <h1 className="text-2xl font-semibold flex items-center"><TrendingUp className="mr-3 h-7 w-7 text-primary" />AI Financial Health Check</h1>
                    <p className="text-muted-foreground">Get a quick, AI-powered overview of your company`s financial status.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select Company</CardTitle>
                    <CardDescription>Choose a company to analyze its financial data, including revenue, expenses, and profitability.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Combobox
                        options={companies}
                        value={selectedCompanyId}
                        onChange={setSelectedCompanyId}
                        placeholder={isLoadingCompanies ? "Loading Companies..." : "Select Company..."}
                        searchPlaceholder="Search companies..."
                        disabled={isLoadingCompanies}
                    />
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || !selectedCompanyId}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing Financials...</> : <><Bot className="mr-2 h-4 w-4" />Analyze</>}
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Financial Health Report</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-primary mb-1">Financial Summary</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.auditSummary}</p>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-green-600 mb-2">Suggested Actions</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.suggestedCorrections}</p>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-destructive mb-2">Potential Risks</h4>
                            <p className="text-muted-foreground whitespace-pre-wrap text-sm">{analysisResult.riskAssessment}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
