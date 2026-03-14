
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, DollarSign, AlertTriangle, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import AiCashFlowForecasterLoading from './loading';
import type { CashFlowOutput } from '@/types/server-only';
import { formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';


export default function AiCashFlowForecasterClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<CashFlowOutput, 'newResourcePoints'> | null>(null);

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewFinancialSummaries;

    const handleAnalyze = async () => {
        if (!user || !userProfile || !dataOwnerId) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/cash-flow-forecaster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, actorUid: user.uid, actorName: userProfile.fullName }),
            });
            const result: CashFlowOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to get cash flow forecast.');

            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Forecast Complete", description: "Your cash flow forecast is ready." });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if (authLoading) return <AiCashFlowForecasterLoading />;

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
                    <h1 className="text-2xl font-semibold flex items-center"><DollarSign className="mr-3 h-7 w-7 text-primary" />AI Cash Flow Forecaster</h1>
                    <p className="text-muted-foreground">Analyzes receivables and payables to anticipate your financial position.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generate Cash Flow Forecast</CardTitle>
                    <CardDescription>The AI will analyze all your unpaid invoices and open purchase orders to create a 30, 60, and 90-day forecast.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Forecasting...</> : <><Bot className="mr-2 h-4 w-4" />Generate Forecast</>}
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Cash Flow Forecast Report</CardTitle>
                        <CardDescription>{analysisResult.forecastSummary}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-4">
                            <ForecastCard period="30-Day" data={analysisResult.thirtyDayForecast} />
                            <ForecastCard period="60-Day" data={analysisResult.sixtyDayForecast} />
                            <ForecastCard period="90-Day" data={analysisResult.ninetyDayForecast} />
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-green-600 mb-2 flex items-center"><CheckCircle className="mr-2 h-4 w-4"/>Actionable Insights</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                {analysisResult.actionableInsights.map((insight, index) => <li key={index}>{insight}</li>)}
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

interface ForecastCardProps {
    period: string;
    data: {
        inflows: number;
        outflows: number;
        netFlow: number;
        analysis: string;
    };
}

function ForecastCard({ period, data }: ForecastCardProps) {
    const isPositive = data.netFlow >= 0;
    return (
        <Card className="flex flex-col">
            <CardHeader><CardTitle>{period} Forecast</CardTitle></CardHeader>
            <CardContent className="flex-grow space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-green-600"><TrendingUp className="mr-1 h-4 w-4"/>Inflows</span>
                    <span>{formatCurrency(data.inflows)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-red-600"><TrendingDown className="mr-1 h-4 w-4"/>Outflows</span>
                    <span>{formatCurrency(data.outflows)}</span>
                </div>
                 <Separator />
                <div className={`flex justify-between items-center font-bold text-lg ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                    <span>Net Flow</span>
                    <span>{formatCurrency(data.netFlow)}</span>
                </div>
            </CardContent>
            <CardFooter className="bg-secondary/50 p-3 text-xs text-muted-foreground border-t">
                {data.analysis}
            </CardFooter>
        </Card>
    );
}