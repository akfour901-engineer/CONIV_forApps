
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, Users, AlertTriangle, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import AiTeamPerformanceLoading from './loading';
import type { TeamPerformanceOutput } from '@/types/server-only';
import { Separator } from '@/components/ui/separator';

export default function AiTeamPerformanceClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<TeamPerformanceOutput, 'newResourcePoints'> | null>(null);

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewActivityLog;

    const handleAnalyze = async () => {
        if (!user || !userProfile || !dataOwnerId) return;
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/team-performance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, actorUid: user.uid, actorName: userProfile.fullName }),
            });
            const result: TeamPerformanceOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to get team performance analysis.');

            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                if (userProfile) {
                    updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
                }
            }
            toast({ title: "Analysis Complete", description: "Team performance report is ready." });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if(authLoading) return <AiTeamPerformanceLoading />;
    
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
                    <h1 className="text-2xl font-semibold flex items-center"><Users className="mr-3 h-7 w-7 text-primary" />AI Team Performance Analyst</h1>
                    <p className="text-muted-foreground">Get insights into your team`s operational efficiency.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Analyze Team Activity</CardTitle>
                    <CardDescription>The AI will analyze the last 200 activity log entries to identify top performers and operational bottlenecks.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : <><Bot className="mr-2 h-4 w-4" />Analyze Team Performance</>}
                    </Button>
                </CardFooter>
            </Card>
            
            {analysisResult && (
                <Card>
                    <CardHeader><CardTitle>Team Performance Report</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                         <div>
                            <h4 className="font-semibold text-primary mb-1">Efficiency Summary</h4>
                            <p className="text-sm text-muted-foreground">{analysisResult.efficiencySummary}</p>
                        </div>
                        <Separator />
                        {analysisResult.topPerformers.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-green-600 mb-2 flex items-center"><UserCheck className="mr-2 h-4 w-4" />Top Performers</h4>
                                <div className="space-y-3">
                                    {analysisResult.topPerformers.map((performer, index) => (
                                        <div key={index} className="p-3 border rounded-md bg-green-500/5">
                                            <p className="font-semibold">{performer.name}</p>
                                            <p className="text-sm text-muted-foreground"><span className="font-medium">Activity Count:</span> {performer.activityCount}</p>
                                            <p className="text-sm text-muted-foreground mt-1"><span className="font-medium">Key Contributions:</span> {performer.contribution}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <Separator />
                         <div>
                            <h4 className="font-semibold text-destructive mb-1">Bottleneck Analysis</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.bottleneckAnalysis}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
