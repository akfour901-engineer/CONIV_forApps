
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { Company, SafetyComplianceOutput } from '@/types/server-only';
import AiSafetyComplianceLoading from './loading';
import { Separator } from '@/components/ui/separator';

export default function AiSafetyComplianceClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<SafetyComplianceOutput, 'newResourcePoints'> | null>(null);
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canRunAudits;

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
            const response = await fetch('/api/ai/safety-compliance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, companyId: selectedCompanyId, actorUid: user.uid, actorName: userProfile.fullName }),
            });
            const result: SafetyComplianceOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to get safety analysis.');

            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Analysis Complete", description: "Safety compliance report is ready." });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if(authLoading || isLoadingCompanies) return <AiSafetyComplianceLoading />;

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
    
    const getRiskColor = (score: number) => {
        if (score >= 75) return "text-red-600";
        if (score >= 40) return "text-orange-500";
        return "text-green-600";
    };

    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><ShieldCheck className="mr-3 h-7 w-7 text-primary" />AI Safety Compliance Officer</h1>
                    <p className="text-muted-foreground">Analyzes site reports for safety-related keywords and concerns.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select Company</CardTitle>
                    <CardDescription>The AI will review all DPRs and SVRs linked to this company for safety concerns.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Combobox options={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} placeholder={isLoadingCompanies ? "Loading..." : "Select Company..."} searchPlaceholder="Search..." disabled={isLoadingCompanies} />
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || !selectedCompanyId}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : <><Bot className="mr-2 h-4 w-4" />Analyze Reports</>}
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Safety & Compliance Report</CardTitle>
                         <div className="flex items-baseline gap-2 pt-2">
                             <span className="font-semibold">Overall Risk Score:</span>
                             <span className={`text-2xl font-bold ${getRiskColor(analysisResult.overallRiskScore)}`}>
                                 {analysisResult.overallRiskScore}/100
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div>
                            <h4 className="font-semibold text-primary mb-1">Overall Assessment</h4>
                            <p className="text-sm text-muted-foreground">{analysisResult.overallAssessment}</p>
                        </div>
                        
                        {analysisResult.potentialRisks.length > 0 && (
                             <div>
                                <h4 className="font-semibold text-destructive mb-2">Potential Risks Identified</h4>
                                <ul className="list-disc list-inside space-y-2">
                                {analysisResult.potentialRisks.map((risk: { description: string; sourceDocument: string; date: string; }, index: number) => (
                                    <li key={index} className="text-sm">
                                        <span className="font-medium">{risk.description}</span>
                                        <p className="text-xs text-muted-foreground pl-4">Source: {risk.sourceDocument} on {risk.date}</p>
                                    </li>
                                ))}
                                </ul>
                            </div>
                        )}
                        
                        <Separator />
                         <div>
                            <h4 className="font-semibold text-green-600 mb-2">Recommendations</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                {analysisResult.recommendations.map((rec: string, index: number) => <li key={index}>{rec}</li>)}
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
