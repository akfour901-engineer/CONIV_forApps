'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { Task, WorkOrder } from '@/types';
import { GanttChartSquare, ArrowLeft, PlusCircle, AlertTriangle, Loader2, Bot } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskDialog } from './task-dialog';
import { GanttChartComponent } from './gantt-chart-component';
import GanttChartLoading from './loading';
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

export default function GanttChartClientPage() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, dataOwnerId, loading: authLoading, appConfig } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [workOrders, setWorkOrders] = useState<ComboboxOption[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const canView = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewWorkOrders || !!currentTeamMemberPermissions?.canViewGanttCharts;
  const canManage = isViewingOwnAccount || !!currentTeamMemberPermissions?.canCreateWorkOrders;
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

  const fetchTasks = useCallback(async () => {
    if (!user || !dataOwnerId || !selectedWorkOrderId) {
      setTasks([]);
      return;
    };
    setIsLoading(true);
    try {
        const idToken = await user.getIdToken();
        const params = new URLSearchParams({ workOrderId: selectedWorkOrderId });
        const response = await fetch(`/api/tasks?${params.toString()}`, { headers: { 'Authorization': `Bearer ${idToken}` }});
        if (!response.ok) throw new Error("Failed to fetch tasks");
        
        const data: Task[] = await response.json();
        setTasks(data);
    } catch(e: any) {
        toast({ title: "Error", description: e.message || "Could not load tasks for this project.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, selectedWorkOrderId, toast]);

  useEffect(() => {
    if(!authLoading && canView) fetchWorkOrders();
    else if (!authLoading) setIsLoading(false);
  }, [authLoading, canView, fetchWorkOrders]);

  useEffect(() => {
    if (selectedWorkOrderId) {
      fetchTasks();
    }
  }, [selectedWorkOrderId, fetchTasks]);

  const handleOpenNewTaskDialog = () => {
    setEditingTask(null);
    setIsTaskDialogOpen(true);
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskDialogOpen(true);
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
      
      toast({ title: "Schedule Generated", description: `${result.tasksCreated} tasks were created. Refreshing...` });
      await fetchTasks(); // Refresh the task list
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
        <p className="text-muted-foreground">You do not have permission to view Gantt charts.</p>
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
          <h1 className="text-2xl font-semibold flex items-center"><GanttChartSquare className="mr-3 h-7 w-7 text-primary" /> Gantt Charts</h1>
          <p className="text-muted-foreground">Visualize your project timelines and task dependencies.</p>
        </div>
        <Button variant="outline" asChild><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Advance Tools</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Select Project</CardTitle>
          <CardDescription>Choose a work order to view or manage its project schedule.</CardDescription>
        </CardHeader>
        <CardContent>
          <Combobox 
            options={workOrders} 
            value={selectedWorkOrderId} 
            onChange={setSelectedWorkOrderId} 
            placeholder={isLoading ? "Loading Work Orders..." : "Select a Work Order..."}
            searchPlaceholder="Search..." 
            disabled={isLoading || workOrders.length === 0} 
            emptyResultText="No work orders found."
          />
        </CardContent>
      </Card>

      {selectedWorkOrderId && (
        <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div>
              <CardTitle>Project Schedule</CardTitle>
              <CardDescription>Click a bar to edit a task, or add new ones.</CardDescription>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button size="sm" onClick={handleGenerateSchedule} disabled={!canUseAI || isGenerating} className="w-full md:w-auto">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4"/>}
                Generate with AI
              </Button>
              <Button size="sm" onClick={handleOpenNewTaskDialog} disabled={!canManage} className="w-full md:w-auto">
                <PlusCircle className="mr-2 h-4 w-4"/>Add Task
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[400px] w-full" /> : 
            <div className="overflow-x-auto">
              <GanttChartComponent tasks={tasks} onTaskClick={handleEditTask} />
            </div>
            }
          </CardContent>
        </Card>
      )}
    </div>
    <TaskDialog 
        isOpen={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        workOrderId={selectedWorkOrderId}
        onTaskSaved={fetchTasks}
        editingTask={editingTask}
    />
    </>
  );
}