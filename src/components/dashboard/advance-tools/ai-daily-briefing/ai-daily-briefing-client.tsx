
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, Sunrise, AlertTriangle, CheckCircle, ListChecks } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import AiDailyBriefingLoading from './loading';
import { Separator } from '@/components/ui/separator';
import { marked } from 'marked';

interface BriefingOutput {
    greeting: string;
    priorityTasks: string[];
    summary: string;
    newResourcePoints?: number;
    error?: string;
}

export default function AiDailyBriefingClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Omit<BriefingOutput, 'newResourcePoints'> | null>(null);

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiDailyBriefing;

    const handleAnalyze = async () => {
        if (!user || !userProfile || !dataOwnerId) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/daily-briefing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, actorUid: user.uid, actorName: userProfile.fullName }),
            });
            const result: BriefingOutput = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to get daily briefing.');

            setAnalysisResult(result);
            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Briefing Generated", description: "Your daily summary is ready." });
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    if(authLoading) return <AiDailyBriefingLoading />;

    if(!canAccessTool) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Permission Denied</h2>
                <p className="text-muted-foreground">You do not have permission to use this tool.</p>
                 <Button asChild className="mt-6"><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center"><Sunrise className="mr-3 h-7 w-7 text-primary" />AI Daily Briefing</h1>
                    <p className="text-muted-foreground">Get a summary of your most important tasks for the day.</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/dashboard/advance-tools">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generate Your Briefing</CardTitle>
                    <CardDescription>The AI will scan your overdue invoices, upcoming deadlines, and new alerts to provide a prioritized list of your most critical tasks.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                        {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Bot className="mr-2 h-4 w-4" />Generate Today`s Briefing</>}
                    </Button>
                </CardFooter>
            </Card>
            
            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">{analysisResult.greeting}</CardTitle>
                        <CardDescription>Here is your AI-generated summary for today.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="font-semibold text-lg text-primary mb-2 flex items-center"><ListChecks className="mr-2 h-5 w-5"/>Priority Tasks</h3>
                            <ul className="space-y-2 list-disc pl-5">
                                {analysisResult.priorityTasks.map((task, index) => (
                                    <li key={index} className="text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(task) as string }}></li>
                                ))}
                            </ul>
                        </div>
                        <Separator />
                        <div>
                            <h3 className="font-semibold text-lg text-primary mb-2">Daily Summary</h3>
                            <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
