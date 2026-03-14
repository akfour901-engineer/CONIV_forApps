'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, HardHat, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { WorkOrder, LaborAnalysisOutput } from '@/types/server-only';
import AiLaborAnalysisLoading from '@/app/dashboard/advance-tools/ai-labor-analysis/loading';
import { Separator } from '@/components/ui/separator';

export default function AiLaborAnalysisClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Omit<LaborAnalysisOutput, 'newResourcePoints'> | null>(null);
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [isLoadingWOs, setIsLoadingWOs] = useState(true);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  
  const canAccessTool = isViewingOwnAccount || !!currentTeamMemberPermissions?.canRunAudits;

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

  const handleAnalyze = async () => {
    if (!selectedWorkOrderId) {
      toast({ title: "Selection Required", description: "Please select a Work Order to analyze.", variant: "destructive" });
      return;
    }
    if (!user || !userProfile || !dataOwnerId) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ai/analyze-labor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ userId: dataOwnerId, workOrderId: selectedWorkOrderId, actorUid: user.uid, actorName: userProfile.fullName }),
      });
      const result: LaborAnalysisOutput = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to get labor analysis.');

      setAnalysisResult(result);
      if (result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
      }
      toast({ title: "Analysis Complete", description: "Labor analysis is ready." });
    } catch (error: any) {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (authLoading) return <AiLaborAnalysisLoading />;
  
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
          <h1 className="text-2xl font-semibold flex items-center"><HardHat className="mr-3 h-7 w-7 text-primary"/>AI Labor Analysis</h1>
          <p className="text-muted-foreground">Get AI-driven insights on labor efficiency and costs for your projects.</p>
        </div>
        <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
      </div>

      <Card>
          <CardHeader><CardTitle>Select Work Order</CardTitle><CardDescription>Choose a project to analyze its labor data.</CardDescription></CardHeader>
          <CardContent>
              <Combobox options={workOrders} value={selectedWorkOrderId} onChange={setSelectedWorkOrderId} placeholder={isLoadingWOs ? "Loading Work Orders..." : "Select Work Order..."} searchPlaceholder="Search..." disabled={isLoadingWOs} emptyResultText="No Work Orders found."/>
          </CardContent>
          <CardFooter>
              <Button onClick={handleAnalyze} disabled={isAnalyzing || !selectedWorkOrderId}>
                  {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing Labor Data...</> : <><Bot className="mr-2 h-4 w-4" />Analyze</>}
              </Button>
          </CardFooter>
      </Card>
      
      {analysisResult && (
          <Card>
              <CardHeader><CardTitle>Labor Analysis Report</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                  <div>
                      <h4 className="font-semibold text-primary mb-1">Audit Summary</h4>
                      <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">{analysisResult.auditSummary}</p>
                  </div>
                  <Separator />
                   <div>
                      <h4 className="font-semibold text-green-600 mb-2">Suggested Corrections & Improvements</h4>
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