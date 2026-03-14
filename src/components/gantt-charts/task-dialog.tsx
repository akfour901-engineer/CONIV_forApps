
'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Save, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@/types';

interface TaskDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  onTaskSaved: () => void;
  editingTask?: Task | null;
}

const taskSchema = z.object({
    name: z.string().min(1, "Task name is required."),
    startDate: z.date({ required_error: "A start date is required."}),
    endDate: z.date({ required_error: "An end date is required." }),
    progress: z.coerce.number().min(0).max(100).default(0),
    dependencies: z.string().optional().nullable(),
}).refine(data => data.endDate >= data.startDate, {
    message: "End date cannot be before start date.",
    path: ["endDate"],
});

type TaskFormValues = z.infer<typeof taskSchema>;

export function TaskDialog({
  isOpen,
  onOpenChange,
  workOrderId,
  onTaskSaved,
  editingTask,
}: TaskDialogProps) {
  const { user, userProfile, dataOwnerId, updateGlobalUserProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!editingTask;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
  });

  React.useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        form.reset({
          name: editingTask.name,
          startDate: new Date(editingTask.startDate),
          endDate: new Date(editingTask.endDate),
          progress: editingTask.progress,
          dependencies: editingTask.dependencies,
        });
      } else {
        form.reset({
          name: '',
          startDate: new Date(),
          endDate: new Date(),
          progress: 0,
          dependencies: '',
        });
      }
    }
  }, [isOpen, editingTask, form]);

  const onSubmit = async (values: TaskFormValues) => {
    if (!user || !dataOwnerId) return;
    setIsSubmitting(true);
    
    const taskData = {
        ...values,
        id: editingTask?.id,
        workOrderId: workOrderId,
    };
    
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/tasks', {
            method: 'POST', // The API route handles both create and update
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(taskData)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || "Failed to save task.");
        }
        
        toast({ title: `Task ${isEditing ? 'updated' : 'created'} successfully.` });

        if (result.newResourcePoints !== undefined && updateGlobalUserProfile && userProfile) {
            updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
        }

        onTaskSaved();
        onOpenChange(false);

    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modify the details of the task.' : 'Add a new task to the project schedule.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="task-dialog-form" className="space-y-4 py-2">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Task Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Start Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>End Date*</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => form.getValues('startDate') ? d < form.getValues('startDate')! : false} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="progress" render={({ field }) => (<FormItem><FormLabel>Progress ({field.value}%)</FormLabel><FormControl><Slider value={[field.value]} onValueChange={(value) => field.onChange(value[0])} max={100} step={1} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dependencies" render={({ field }) => (<FormItem><FormLabel>Dependencies (Optional)</FormLabel><FormControl><Input placeholder="Comma-separated task IDs" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            </form>
        </Form>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="submit" form="task-dialog-form" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
