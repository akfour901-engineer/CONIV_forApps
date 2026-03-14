'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, Target, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { Company, BidAdvisorOutput } from '@/types/server-only';
import AiBidAdvisorLoading from '@/app/dashboard/advance-tools/ai-bid-advisor/loading';
import { Separator } from '@/components/ui/separator';
import type { BidAdvisorInput } from '@/ai/flows/bid-advisor-flow';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function AiBidAdvisorClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<BidAdvisorOutput, 'newResourcePoints'> | null>(null);
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [tenderDetails, setTenderDetails] = useState('');

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
        if (!tenderDetails.trim()) {
            toast({ title: "Input Required", description: "Please provide tender details or a scope of work.", variant: "destructive" });
            return;
        }
        if (!user || !userProfile || !dataOwnerId) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const idToken = await user.getIdToken();
            const input: BidAdvisorInput = {
                userId: dataOwnerId,
                companyId: selectedCompanyId,
                tenderDetails,
                actorUid: user.uid,
                actorName: userProfile.fullName || undefined,
            };

            const response = await fetch('/api/ai/bid-advisor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(input)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get recommendation.');
            }

            const result: BidAdvisorOutput = await response.json();

            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                if(userProfile) {
                    updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
                }
            }
            toast({ title: "Analysis Complete", description: "Your Bid/No-Bid recommendation is ready." });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if(authLoading || isLoadingCompanies) return <AiBidAdvisorLoading />;

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
    
    const getRecommendationColor = (recommendation: string) => {
        if (recommendation.includes('Strongly Recommend')) return 'bg-green-100 text-green-800';
        if (recommendation.includes('Recommend')) return 'bg-blue-100 text-blue-800';
        if (recommendation.includes('Caution')) return 'bg-yellow-100 text-yellow-800';
        if (recommendation.includes('Do Not')) return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><Target className="mr-3 h-7 w-7 text-primary" />AI Bid/No-Bid Advisor</h1>
                    <p className="text-muted-foreground">Get AI-powered recommendations on which tenders to pursue.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tender Analysis</CardTitle>
                    <CardDescription>Select the company that would bid and paste the tender details/scope of work.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Combobox options={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} placeholder="Select Company..." searchPlaceholder="Search companies..." disabled={isLoadingCompanies} />
                    <Textarea placeholder="Paste tender details, scope of work, eligibility criteria, etc. here..." value={tenderDetails} onChange={(e) => setTenderDetails(e.target.value)} rows={10} />
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : <><Bot className="mr-2 h-4 w-4" />Analyze Tender</>}
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Analysis Report</CardTitle>
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                             <Badge className={`text-lg px-4 py-1 capitalize ${getRecommendationColor(analysisResult.recommendation)}`}>
                                {analysisResult.recommendation}
                            </Badge>
                             <div className="font-semibold text-lg">Score: <span className="font-bold text-primary">{analysisResult.recommendationScore}/100</span></div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-primary mb-1">Reasoning</h4>
                            <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">{analysisResult.reasoning}</p>
                        </div>
                        <Separator />
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold text-green-600 mb-2">Pros (Reasons to Bid)</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    {analysisResult.pros.map((pro, index) => <li key={index}>{pro}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-destructive mb-2">Cons (Risks & Weaknesses)</h4>
                                 <ul className="list-disc list-inside space-y-1 text-sm">
                                    {analysisResult.cons.map((con, index) => <li key={index}>{con}</li>)}
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}