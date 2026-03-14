
'use client';

import * as React from 'react';
import { eachDayOfInterval, startOfMonth, endOfMonth, format, isSameDay, isWeekend } from 'date-fns';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LabourRegister } from '@/types/server-only';
import { cn } from '@/lib/utils';
import { Check, Edit, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface TimeLogData {
  [labourerId: string]: {
    [date: string]: {
      hoursWorked: number | null;
      remarks: string | null;
      id?: string;
    };
  };
}

interface TimeTrackingGridProps {
  labourers: LabourRegister[];
  month: Date;
  timeLogs: TimeLogData;
  setTimeLogs: React.Dispatch<React.SetStateAction<TimeLogData>>;
  onLogUpdateSuccess: () => void;
}

const AttendanceCell = ({
  labourerId,
  day,
  log,
  workOrderId,
  onLogUpdateSuccess,
}: {
  labourerId: string;
  day: Date;
  log?: { hoursWorked: number | null; remarks: string | null, id?: string };
  workOrderId: string;
  onLogUpdateSuccess: () => void;
}) => {
  const { toast } = useToast();
  const { user, dataOwnerId } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [hours, setHours] = React.useState(log?.hoursWorked ?? null);
  const [remarks, setRemarks] = React.useState(log?.remarks ?? '');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setHours(log?.hoursWorked ?? null);
      setRemarks(log?.remarks ?? '');
    }
  }, [isOpen, log]);

  const handleUpdate = async () => {
    if (!user || !dataOwnerId) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }

    const numericHours = hours === null ? null : Number(hours);
    if (numericHours !== null && (isNaN(numericHours) || numericHours < 0 || numericHours > 24)) {
      toast({ title: "Invalid Input", description: "Hours must be between 0 and 24.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/dashboard/time-logs', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
            body: JSON.stringify({ 
                workOrderId: workOrderId,
                dataOwnerId,
                timeLogItem: {
                    labourRegisterId: labourerId,
                    date: format(day, 'yyyy-MM-dd'),
                    hoursWorked: numericHours,
                    remarks: remarks,
                    existingTimeLogId: log?.id,
                }
             }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to save time log.');
        }
        
        toast({ title: "Attendance Updated", description: `Logged ${numericHours ?? 'N/A'} hours.` });
        onLogUpdateSuccess();
        setIsOpen(false);
    } catch(e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const getCellContent = () => {
    if (log?.hoursWorked === null || log?.hoursWorked === undefined) return <X className="h-4 w-4 text-gray-400" />;
    if (log?.hoursWorked === 0) return <span className="text-red-500 font-bold">A</span>;
    if (log?.hoursWorked >= 8) return <Check className="h-4 w-4 text-green-600" />;
    return <span className="font-semibold text-blue-600 text-xs">{log.hoursWorked}h</span>;
  };
  
  const cellStyle = log?.hoursWorked === 0 ? "bg-red-50 dark:bg-red-900/20" : log?.hoursWorked ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/30";
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full h-10 flex items-center justify-center text-xs border rounded transition-colors hover:bg-accent hover:border-primary/50",
            cellStyle,
            isWeekend(day) && 'bg-secondary/50'
          )}
        >
          {getCellContent()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 space-y-4">
        <div className="text-sm font-semibold">Log for {format(day, 'dd MMM yyyy')}</div>
        <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => setHours(8)}>Full</Button>
            <Button variant="outline" size="sm" onClick={() => setHours(4)}>Half</Button>
            <Button variant="destructive" size="sm" onClick={() => setHours(0)}>Absent</Button>
        </div>
        <div className="space-y-1">
            <Label htmlFor="customHours">Custom Hours</Label>
            <Input id="customHours" type="number" value={hours ?? ""} onChange={(e) => setHours(e.target.value === '' ? null : parseFloat(e.target.value))} placeholder="e.g., 6.5" />
        </div>
        <div className="space-y-1">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g., Overtime, left early" />
        </div>
        <Button onClick={handleUpdate} disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            Update
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export function TimeTrackingGrid({ labourers, month, timeLogs, setTimeLogs, onLogUpdateSuccess }: TimeTrackingGridProps) {
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  return (
    <div className="w-full overflow-x-auto relative border rounded-lg">
      <Table className="min-w-full divide-y divide-gray-200">
        <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-20 p-2 text-xs h-12 w-40 min-w-[160px] border-r">Labourer</TableHead>
            {daysInMonth.map((day) => (
              <TableHead key={day.toISOString()} className={cn("p-1 text-center h-12 w-[60px] min-w-[60px] text-xs font-normal", isSameDay(day, new Date()) && "bg-blue-100 dark:bg-blue-900/30")}>
                <div className={cn("text-muted-foreground", isWeekend(day) && "text-primary/70")}>{format(day, 'EEE')}</div>
                <div className="font-semibold text-foreground text-base">{format(day, 'd')}</div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {labourers.map((labourer) => {
             if (!labourer.id) {
              console.warn("Skipping labourer with undefined ID:", labourer);
              return null;
            }
            return (
            <TableRow key={labourer.id}>
              <TableCell className="sticky left-0 bg-background z-10 p-2 text-xs font-medium w-40 min-w-[160px] border-r">
                <p className="font-semibold truncate">{labourer.workerName}</p>
                <p className="text-muted-foreground truncate">{labourer.role}</p>
              </TableCell>
              {daysInMonth.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const log = timeLogs[labourer.id!]?.[dateStr];
                return (
                  <TableCell key={dateStr} className="p-1 w-[60px] min-w-[60px]">
                    <AttendanceCell
                      labourerId={labourer.id!}
                      day={day}
                      log={log}
                      workOrderId={labourer.workOrderId}
                      onLogUpdateSuccess={onLogUpdateSuccess}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
  );
}
