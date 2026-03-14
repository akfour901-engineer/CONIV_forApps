
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ShieldAlert, Bot, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import AiFraudDetectorLoading from './loading';
import { Badge } from '@/components/ui/badge';
import type { SuspiciousActivity, FraudAnalysisOutput } from '@/types/server-only';
import { runFraudAnalysis } from '@/ai/flows/fraud-detector-flow';

export default function AiFraudDetectorClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<FraudAnalysisOutput, 'newResourcePoints'> | null>(null);

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canRunAudits;

    const handleAnalyze = async () => {
        if (!user || !userProfile || !dataOwnerId) return;
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const result = await runFraudAnalysis({
                dataOwnerId: dataOwnerId,
                actorUid: user.uid,
                actorName: userProfile.fullName || undefined,
            });

            if (result.error) {
              throw new Error(result.error);
            }

            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Fraud Analysis Complete", description: `Found ${result.suspiciousActivities.length} potential issues.` });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if(authLoading) return <AiFraudDetectorLoading />;

    if(!canAccessTool) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to use this tool.</p>
            </div>
        );
    }

    const getRiskColor = (score: number) => {
        if (score >= 75) return "text-red-600";
        if (score >= 40) return "text-orange-500";
        return "text-green-600";
    };
    
    const getRiskLabel = (score: number) => {
        if (score >= 75) return "High";
        if (score >= 40) return "Medium";
        return "Low";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><ShieldAlert className="mr-3 h-7 w-7 text-primary" />AI Fraudulent Activity Detector</h1>
                    <p className="text-muted-foreground">Monitors activity logs to flag suspicious behavior and potential threats.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Scan Activity Logs</CardTitle>
                    <CardDescription>The AI will analyze the last 500 activity log entries for suspicious patterns.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning...</> : <><Bot className="mr-2 h-4 w-4" />Scan for Suspicious Activity</>}
                    </Button>
                </CardFooter>
            </Card>

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Fraud Detection Report</CardTitle>
                        <div className="flex items-baseline gap-2 pt-2">
                             <span className="font-semibold">Overall Risk Score:</span>
                             <span className={`text-2xl font-bold ${getRiskColor(analysisResult.riskScore)}`}>
                                 {analysisResult.riskScore}/100 ({getRiskLabel(analysisResult.riskScore)})
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-primary mb-1">Analysis Summary</h4>
                            <p className="text-sm text-muted-foreground">{analysisResult.analysisSummary}</p>
                        </div>
                        
                        {analysisResult.suspiciousActivities.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-destructive mb-2">Flagged Activities</h4>
                                <div className="space-y-3">
                                    {analysisResult.suspiciousActivities.map((activity, index) => (
                                        <div key={index} className="p-3 border rounded-md bg-destructive/5">
                                            <p className="font-semibold">{activity.description}</p>
                                            <p className="text-sm text-muted-foreground"><span className="font-medium">Reason:</span> {activity.reason}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Associated Log ID: {activity.activityLogId || 'N/A'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <h4 className="font-semibold text-green-600 mb-1">Recommendations</h4>
                            <p className="text-sm text-muted-foreground">{analysisResult.recommendations}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
