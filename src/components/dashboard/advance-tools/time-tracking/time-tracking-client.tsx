
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Clock, Search, ChevronLeft, ChevronRight, AlertTriangle, PlusCircle, Loader2, Bot } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { LabourRegister, WorkOrder, LabourTimeLog } from '@/types';
import { TimeTrackingGrid } from './time-tracking-grid';
import GanttChartLoading from '@/components/gantt-charts/loading';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { addMonths, subMonths, format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { AI_PROJECT_SCHEDULER_COST } from '@/lib/constants';

interface TimeLogData {
  [labourerId: string]: {
    [date: string]: {
      hoursWorked: number | null;
      remarks: string | null;
      id?: string;
    };
  };
}

export default function TimeTrackingClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, appConfig } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('');
  const [labourers, setLabourers] = useState<LabourRegister[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogData>({});
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canManage = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageTimeTracking || !!currentTeamMemberPermissions?.canRecordLabourAttendance;
  const canView = canManage;
  const canUseAI = isViewingOwnAccount || !!currentTeamMemberPermissions?.canUseAiProjectScheduler;

  const fetchWorkOrders = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
      if (!response.ok) throw new Error("Failed to fetch work orders");
      const data: WorkOrder[] = await response.json();
      setWorkOrders(data.map(wo => ({ value: wo.id!, label: `${wo.workOrderNumber} - ${wo.organizationName}` })));

      const woIdFromParams = searchParams?.get('workOrderId') ?? '';
      if (woIdFromParams && data.some(wo => wo.id === woIdFromParams)) {
        setSelectedWorkOrderId(woIdFromParams);
      } else if (data.length > 0) {
        setSelectedWorkOrderId(data[0].id!);
      }
    } catch (e) { 
      console.error(e);
      toast({ title: "Error", description: "Could not load work orders.", variant: "destructive" }); 
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast, searchParams]);

  const fetchTimeTrackingData = useCallback(async () => {
    if (!user || !dataOwnerId || !selectedWorkOrderId) {
      setLabourers([]);
      setTimeLogs({});
      return;
    };
    setIsLoading(true);
    try {
        const idToken = await user.getIdToken();
        const params = new URLSearchParams({
            workOrderId: selectedWorkOrderId,
            date: format(currentMonth, 'yyyy-MM'),
            dataOwnerId: dataOwnerId,
        });
        const response = await fetch(`/api/dashboard/time-logs?${params.toString()}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
        if (!response.ok) throw new Error("Failed to fetch time tracking data");
        
        const { labourers: fetchedLabourers, timeLogs: fetchedTimeLogs } = await response.json();
        setLabourers(fetchedLabourers);

        const timeLogMap: TimeLogData = {};
        fetchedTimeLogs.forEach((log: LabourTimeLog & {id: string}) => {
            if (!timeLogMap[log.labourRegisterId]) {
            timeLogMap[log.labourRegisterId] = {};
            }
            timeLogMap[log.labourRegisterId][log.date] = { hoursWorked: log.hoursWorked ?? null, remarks: log.remarks ?? null, id: log.id };
        });
        setTimeLogs(timeLogMap);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Could not load time tracking data for this project.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, selectedWorkOrderId, currentMonth, toast]);

  useEffect(() => {
    if(!authLoading && canView) fetchWorkOrders();
    else if (!authLoading) setIsLoading(false);
  }, [authLoading, canView, fetchWorkOrders]);

  useEffect(() => {
    if (selectedWorkOrderId) {
      fetchTimeTrackingData();
    }
  }, [selectedWorkOrderId, currentMonth, fetchTimeTrackingData]);

  const handleOpenNewTaskDialog = () => {
    // This function seems to be a remnant. No TaskDialog is used here.
    // If you intend to add task creation, the dialog must be implemented and rendered.
    console.log("New Task Dialog trigger - no dialog implemented");
  };
  
  const handleGenerateSchedule = async () => {
    if (!user || !userProfile || !dataOwnerId || !selectedWorkOrderId || !appConfig) return;

    const cost = appConfig?.actionCosts?.find((c) => c.key === 'AI_PROJECT_SCHEDULER_COST')?.cost ?? AI_PROJECT_SCHEDULER_COST;
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
        body: JSON.stringify({ workOrderId: selectedWorkOrderId, userId: dataOwnerId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to generate schedule.');
      
      toast({ title: "Schedule Generated", description: `${result.tasksCreated} tasks were created. Redirecting to Gantt chart...` });
      router.push(`/dashboard/gantt-charts?workOrderId=${selectedWorkOrderId}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) return <GanttChartLoading />;

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage time tracking.</p>
        <Button asChild className="mt-6"><Link href="/dashboard/advance-tools">Back to Advance Tools</Link></Button>
      </div>
    );
  }

  return (
    <>
    <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center"><Clock className="mr-3 h-7 w-7 text-primary" /> Labour Time Tracking</h1>
          <p className="text-muted-foreground">Track daily attendance and hours worked for your labour force.</p>
        </div>
        <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Select Project</CardTitle>
          <CardDescription>Choose a work order and month to view the attendance sheet.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Combobox 
            options={workOrders} 
            value={selectedWorkOrderId} 
            onChange={setSelectedWorkOrderId} 
            placeholder={isLoading ? "Loading Work Orders..." : "Select a Work Order..."}
            searchPlaceholder="Search..." 
            disabled={isLoading || workOrders.length === 0} 
            emptyResultText="No work orders found."
            className="w-full md:w-1/2"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-semibold text-center w-32">{format(currentMonth, 'MMMM yyyy')}</span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {selectedWorkOrderId && (
        <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div>
                <CardTitle>Attendance Sheet</CardTitle>
                <CardDescription>Click on a cell to log hours for a specific day.</CardDescription>
            </div>
            {canManage && <Button asChild size="sm" variant="outline"><Link href={`/dashboard/labour-register/new?workOrderId=${selectedWorkOrderId}`}><PlusCircle className="mr-2 h-4 w-4"/>Add Labourer</Link></Button>}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : labourers.length > 0 ? (
                <TimeTrackingGrid 
                    labourers={labourers} 
                    month={currentMonth} 
                    timeLogs={timeLogs} 
                    setTimeLogs={setTimeLogs}
                    onLogUpdateSuccess={fetchTimeTrackingData}
                />
            ) : (
                <p className="text-muted-foreground text-center py-8">No labourers registered for this work order.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}
