
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Cell } from 'recharts';
import type { Task } from '@/types';
import { format, differenceInDays, parseISO, addDays, isSameDay, startOfDay } from 'date-fns';
import { useTheme } from 'next-themes';

interface GanttChartComponentProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

interface ChartTask {
  id?: string;
  name: string;
  start: number;
  duration: number;
  progress: number;
  startDate: string;
  endDate: string;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border shadow-sm rounded-lg p-3 text-sm">
          <p className="font-bold">{data.name}</p>
          <p>Start: {data.startDate}</p>
          <p>End: {data.endDate}</p>
          <p>Duration: {data.duration} day(s)</p>
          <p>Progress: {data.progress}%</p>
        </div>
      );
    }
    return null;
  };

export function GanttChartComponent({ tasks, onTaskClick }: GanttChartComponentProps) {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

  const projectStartDate = React.useMemo(() => {
    if (tasks.length === 0) return startOfDay(new Date());
    return tasks.reduce((min, task) => {
      const taskStart = parseISO(task.startDate);
      return taskStart < min ? taskStart : min;
    }, parseISO(tasks[0].startDate));
  }, [tasks]);

  const chartData: ChartTask[] = React.useMemo(() => {
    return tasks.map(task => {
        const taskStart = parseISO(task.startDate);
        const taskEnd = parseISO(task.endDate);
        const startDay = differenceInDays(taskStart, projectStartDate);
        const duration = differenceInDays(taskEnd, taskStart) + 1; // Inclusive of start and end day
        return {
            id: task.id,
            name: task.name,
            start: startDay,
            duration: duration,
            progress: task.progress,
            startDate: format(taskStart, 'dd MMM'),
            endDate: format(taskEnd, 'dd MMM'),
        }
    });
  }, [tasks, projectStartDate]);
  
  const handleBarClick = (data: any) => {
    const originalTask = tasks.find(t => t.id === data.id);
    if(originalTask) {
        onTaskClick(originalTask);
    }
  };

  if (tasks.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No tasks to display for this project. Add tasks to see the Gantt chart.</div>;
  }

  return (
    <div className="w-full relative">
        <div style={{ width: '100%', minWidth: '600px', height: 60 * tasks.length + 60, minHeight: 300 }}>
            <ResponsiveContainer>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" unit=" days" label={{ value: 'Days from Project Start', position: 'insideBottom', offset: -10, fill: isDarkMode ? '#a1a1aa' : '#71717a' }}/>
                    <YAxis type="category" dataKey="name" width={150} tick={{ fill: isDarkMode ? '#a1a1aa' : '#71717a' }}/>
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128,128,128,0.1)' }} />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar name="Timeline" dataKey="start" stackId="a" fill="transparent" stroke="transparent" />
                    <Bar name="Duration" dataKey="duration" stackId="a" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 4, 4]} className="cursor-pointer" onClick={handleBarClick}>
                        <LabelList
                            dataKey="progress"
                            position="insideRight"
                            formatter={(value: number) => `${value}%`}
                            fill="#fff"
                            className="text-xs font-semibold"
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
}
