
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, GanttChart as GanttIcon, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { WorkOrder } from '@/types/server-only';
import AiProjectSchedulerLoading from './loading';
import { useRouter } from 'next/navigation';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { AI_PROJECT_SCHEDULER_COST } from '@/lib/constants';

export default function AiProjectSchedulerClientPage() {
    const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile, appConfig } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
    const [isLoadingWOs, setIsLoadingWOs] = useState(true);
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
    
    const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
    const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

    const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiProjectScheduler;

    useEffect(() => {
        if (user && dataOwnerId) {
            const fetchWOs = async () => {
                setIsLoadingWOs(true);
                try {
                    const idToken = await user.getIdToken();
                    const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
                    if (!response.ok) throw new Error("Failed to fetch Work Orders.");
                    const data: WorkOrder[] = await response.json();
                    setWorkOrders(data.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));
                } catch (e: any) {
                    toast({ title: "Error", description: `Could not load Work Orders: ${e.message}`, variant: "destructive" });
                } finally {
                    setIsLoadingWOs(false);
                }
            };
            fetchWOs();
        }
    }, [user, dataOwnerId, toast]);

    const handleGenerate = async () => {
        if (!selectedWorkOrderId) {
            toast({ title: "Selection Required", description: "Please select a Work Order.", variant: "destructive" });
            return;
        }
        if (!user || !userProfile || !dataOwnerId || !appConfig) return;

        const cost = appConfig.actionCosts?.find((c) => c.key === 'AI_PROJECT_SCHEDULER_COST')?.cost ?? AI_PROJECT_SCHEDULER_COST;
        const currentPoints = userProfile.resourcePoints ?? 0;
        if (currentPoints < cost) {
          setPointsInfo({ required: cost, current: currentPoints });
          setIsPointsDialogOpen(true);
          return;
        }

        setIsGenerating(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/ai/generate-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ userId: dataOwnerId, workOrderId: selectedWorkOrderId, actorUid: user.uid, actorName: userProfile.fullName }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to generate schedule.');

            if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            
            toast({ title: "Schedule Generated", description: `${result.tasksCreated} tasks were created. You are being redirected.` });
            router.push(`/dashboard/gantt-charts?workOrderId=${selectedWorkOrderId}`);
        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };
    
    if(authLoading || isLoadingWOs) return <AiProjectSchedulerLoading />;
    
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
        <>
            <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold flex items-center"><GanttIcon className="mr-3 h-7 w-7 text-primary" />AI Project Scheduler</h1>
                        <p className="text-muted-foreground">Automatically generate a project schedule from a Work Order.</p>
                    </div>
                    <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Select Work Order</CardTitle>
                        <CardDescription>Choose a Work Order. The AI will analyze its scope and items to create a task schedule and Gantt chart.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Combobox options={workOrders} value={selectedWorkOrderId} onChange={setSelectedWorkOrderId} placeholder={isLoadingWOs ? "Loading Work Orders..." : "Select Work Order..."} searchPlaceholder="Search..." disabled={isLoadingWOs} />
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleGenerate} disabled={isGenerating || !selectedWorkOrderId}>
                            {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating & Redirecting...</> : <><Bot className="mr-2 h-4 w-4" />Generate Schedule</>}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </>
    );
}
