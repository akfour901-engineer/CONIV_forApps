
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Sector, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/hooks/use-auth';
import type { AdvancedReportingData, YearlyFinancialSummary, WorkOrderProfitLoss, Expense } from '@/types/server-only';
import { ArrowLeft, AlertTriangle, BarChart3, LineChartIcon, PieChartIcon as RechartsPieIcon, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import FinancialSummaryLoadingSkeleton from '@/app/dashboard/financial-summary/loading';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { CHART_COLORS } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';


const ProfitLossIndicator = ({ value }: { value: number }) => {
    const isProfit = value >= 0;
    const isLoss = value < 0;
    return (
      <div className={cn("flex items-center justify-center font-semibold", isProfit && "text-green-600", isLoss && "text-destructive")}>
        {isProfit && <ArrowUpRight className="mr-1 h-4 w-4 shrink-0" />}
        {isLoss && <ArrowDownRight className="mr-1 h-4 w-4 shrink-0" />}
        <span className="truncate">{formatCurrency(value)}</span>
      </div>
    );
};

const formatMonth = (monthStr: string) => format(parseISO(monthStr + '-01'), 'MMM yyyy');


export default function FinancialSummaryClientPage() {
  const { user, currentTeamMemberPermissions, loading: authLoading, dataOwnerId, isViewingOwnAccount } = useAuth();
  const [reportingData, setReportingData] = useState<AdvancedReportingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePieIndex, setActivePieIndex] = useState(0);
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [woCurrentPage, setWoCurrentPage] = useState(1);
  const [woItemsPerPage, setWoItemsPerPage] = useState(5);
  
  const [miscExpCurrentPage, setMiscExpCurrentPage] = useState(1);
  const [miscExpItemsPerPage, setMiscExpItemsPerPage] = useState(5);

  const canView = isViewingOwnAccount || !!currentTeamMemberPermissions?.canViewFinancialSummaries;

  useEffect(() => {
    if (authLoading || !dataOwnerId) {
      if (!authLoading && !dataOwnerId) setIsLoading(false);
      return;
    }
    
    if (!canView) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const idToken = await user!.getIdToken();
        const response = await fetch(`/api/dashboard/financial-summary?dataOwnerId=${dataOwnerId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API Error: ${response.status}`);
        }
        const data: AdvancedReportingData = await response.json();
        setReportingData(data);
      } catch (error: any) { 
        console.error("Error fetching reporting data (from API):", error);
        toast({ title: "Error Loading Reports", description: error.message, variant: "destructive" });
      }
      setIsLoading(false);
    };
    fetchData();
  }, [dataOwnerId, authLoading, canView, user, toast]);


  const onPieEnter = (_: any, index: number) => {
    setActivePieIndex(index);
  };

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 5) * cos;
    const sy = cy + (outerRadius + 5) * sin;
    const mx = cx + (outerRadius + 20) * cos;
    const my = cy + (outerRadius + 20) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 12;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-semibold text-sm">
          {payload.name}
        </text>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 4} outerRadius={outerRadius + 8} fill={fill} />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#333" className="text-xs">{`${formatCurrency(value)}`}</text>
        <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={12} textAnchor={textAnchor} fill="#999" className="text-xs">
          {`(${(percent * 100).toFixed(2)}%)`}
        </text>
      </g>
    );
  };


  if (authLoading) { return <FinancialSummaryLoadingSkeleton />; }
  if (!canView && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view advanced reports.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/advance-tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
      </div>
    );
  }
  if (isLoading) { return <FinancialSummaryLoadingSkeleton />; }
  if (!reportingData) { return <div className="text-center py-10">No data available for reporting.</div> }
  
  const woPaginated = reportingData.workOrderBreakdown.slice((woCurrentPage - 1) * woItemsPerPage, woCurrentPage * woItemsPerPage);
  const woTotalPages = Math.ceil(reportingData.workOrderBreakdown.length / woItemsPerPage);
  
  const miscExpPaginated = reportingData.miscExpenses.slice((miscExpCurrentPage - 1) * miscExpItemsPerPage, miscExpCurrentPage * miscExpItemsPerPage);
  const miscExpTotalPages = Math.ceil(reportingData.miscExpenses.length / miscExpItemsPerPage);

  const statusColors: Record<string, string> = {
    draft: 'hsl(var(--chart-1))', submitted: 'hsl(var(--chart-2))', approved: 'hsl(var(--chart-3))', rejected: 'hsl(var(--chart-5))', expired: 'hsl(var(--chart-4))',
    pending: 'hsl(var(--chart-4))', 'in-progress': 'hsl(var(--chart-2))', completed: 'hsl(var(--chart-3))', 'on-hold': 'hsl(var(--chart-1))', cancelled: 'hsl(var(--chart-5))',
    sent: 'hsl(var(--chart-2))', unpaid: 'hsl(var(--chart-4))', paid: 'hsl(var(--chart-3))', overdue: 'hsl(var(--chart-5))', 'partially-paid': 'hsl(var(--chart-1))'
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center"><BarChart3 className="mr-3 h-7 w-7 text-primary" /> Financial Summary</h1>
          <p className="text-muted-foreground">Visualize your business data with key metrics and charts.</p>
        </div>
      </div>
      
       <Card className="shadow-lg">
        <CardHeader><CardTitle>Overall Financial Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-green-50 rounded-lg min-w-0">
                <p className="text-sm font-medium text-green-700">Total Revenue</p>
                <p className="text-xl md:text-2xl font-bold text-green-800 break-words">{formatCurrency(reportingData.totalRevenue)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg min-w-0">
                <p className="text-sm font-medium text-red-700">Total Expenses</p>
                <p className="text-xl md:text-2xl font-bold text-red-800 break-words">{formatCurrency(reportingData.totalExpenses)}</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg min-w-0">
                <p className="text-sm font-medium text-primary">Net Profit / Loss</p>
                <div className="text-xl md:text-2xl break-words"><ProfitLossIndicator value={reportingData.overallProfitLoss} /></div>
            </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><LineChartIcon className="mr-2 h-5 w-5 text-primary" /> Monthly Income vs. Expenses</CardTitle>
            <CardDescription>Track your financial performance over the past months. Income is based on paid invoices.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            {reportingData && reportingData.monthlyFinancials && reportingData.monthlyFinancials.length > 0 ? (
              <ChartContainer config={{}} className="min-h-[200px] w-full h-full">
                <LineChart accessibilityLayer data={reportingData.monthlyFinancials} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} angle={-30} textAnchor="end" interval="preserveStartEnd" minTickGap={30} />
                  <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" tickFormatter={(value) => formatCurrency(value)} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} labelFormatter={formatMonth} />} />
                  <Legend verticalAlign="top" />
                  <Line yAxisId="left" type="monotone" dataKey="income" name="Income (Paid Invoices)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="left" type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No financial data available for income vs. expenses chart.</p></div>
            )}
          </CardContent>
        </Card>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center"><RechartsPieIcon className="mr-2 h-5 w-5 text-primary" /> Expense Category Breakdown</CardTitle>
                <CardDescription>Distribution of your expenses across different categories.</CardDescription>
            </CardHeader>
            <CardContent className="h-[450px]">
                {reportingData && reportingData.expenseCategoriesData && reportingData.expenseCategoriesData.length > 0 ? (
                <ChartContainer config={{}} className="min-h-[200px] w-full h-full">
                    <PieChart>
                    <Pie activeIndex={activePieIndex} activeShape={renderActiveShape} data={reportingData.expenseCategoriesData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} fill="hsl(var(--chart-1))" dataKey="value" onMouseEnter={onPieEnter}>
                        {reportingData.expenseCategoriesData.map((entry: any, index: number) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{paddingTop: '20px'}} iconSize={10} />
                    </PieChart>
                </ChartContainer>
                ) : (
                <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No expense data available for category breakdown chart.</p></div>
                )}
            </CardContent>
          </Card>
           <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary" /> Work Order Profitability</CardTitle>
                <CardDescription>Revenue, expenses, and profit for each work order.</CardDescription>
            </CardHeader>
            <CardContent className="h-[450px]">
                {reportingData && reportingData.workOrderBreakdown && reportingData.workOrderBreakdown.length > 0 ? (
                <ChartContainer config={{}} className="min-h-[200px] w-full h-full">
                    <BarChart data={reportingData.workOrderBreakdown.filter((wo: WorkOrderProfitLoss) => wo.totalRevenue > 0 || wo.totalExpenses > 0)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5, }}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                        <YAxis type="category" dataKey="workOrderNumber" width={80} interval={0} />
                        <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                        <Legend />
                        <Bar dataKey="totalRevenue" name="Revenue" fill="hsl(var(--primary))" />
                        <Bar dataKey="totalExpenses" name="Expenses" fill="hsl(var(--destructive))" />
                    </BarChart>
                </ChartContainer>
                ) : ( <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No work order financial data to display.</p></div> )}
            </CardContent>
          </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader><CardTitle>Estimates by Status</CardTitle><CardDescription>Count and total value of estimates per status.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="h-[350px] min-w-[600px]">
              {reportingData && reportingData.estimatesData && reportingData.estimatesData.filter((d: any) => (d.count ?? 0) > 0 || (d.totalValue ?? 0) > 0).length > 0 ? (
                <ChartContainer config={{}} className="w-full h-full">
                  <BarChart data={reportingData.estimatesData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                    <CartesianGrid vertical={false} /><XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} minTickGap={30} />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<ChartTooltipContent formatter={(value, name) => name === 'Total Value' ? formatCurrency(Number(value)) : value} />} /> <Legend verticalAlign="top" />
                    <Bar yAxisId="left" dataKey="count" name="Count">{reportingData.estimatesData.map((d: any, index: number) => (<Cell key={`cell-est-count-${index}`} fill={statusColors[d.name.toLowerCase().replace(/ /g, '_')] || 'hsl(var(--primary))'} />))}</Bar>
                    <Bar yAxisId="right" dataKey="totalValue" name="Total Value" fill="hsl(var(--accent))" />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No estimate data available.</p></div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader><CardTitle>Work Orders by Status</CardTitle><CardDescription>Count and total value of work orders per status.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
             <div className="h-[350px] min-w-[600px]">
              {reportingData && reportingData.workOrdersData && reportingData.workOrdersData.filter((d: any) => (d.count ?? 0) > 0 || (d.totalValue ?? 0) > 0).length > 0 ? (
                <ChartContainer config={{}} className="w-full h-full">
                  <BarChart data={reportingData.workOrdersData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                    <CartesianGrid vertical={false} /><XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} minTickGap={30} />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<ChartTooltipContent formatter={(value: any, name: any) => name === 'Total Value' ? formatCurrency(Number(value)) : value}/>} /> <Legend verticalAlign="top" />
                    <Bar yAxisId="left" dataKey="count" name="Count">{reportingData.workOrdersData.map((d: any, index: number) => (<Cell key={`cell-wo-count-${index}`} fill={statusColors[d.name.toLowerCase().replace(/ /g, '-')] || 'hsl(var(--primary))'} />))}</Bar>
                    <Bar yAxisId="right" dataKey="totalValue" name="Total Value" fill="hsl(var(--accent))" />
                  </BarChart>
                </ChartContainer>
              ) : (
                 <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No work order data available.</p></div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Invoices Overview by Status</CardTitle><CardDescription>Total value and outstanding balance for invoices per status.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="h-[400px] min-w-[600px]">
           {reportingData && reportingData.invoicesData && reportingData.invoicesData.filter((d: any) => (d.totalValue ?? 0) > 0 || (d.balanceDue ?? 0) > 0).length > 0 ? (
              <ChartContainer config={{}} className="w-full h-full">
                <BarChart data={reportingData.invoicesData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                  <CartesianGrid vertical={false} /><XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} minTickGap={30} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)}/>
                  <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} /><Legend verticalAlign="top" />
                  <Bar dataKey="totalValue" name="Total Value" stackId="a" fill="hsl(var(--primary))" barSize={20} />
                  <Bar dataKey="balanceDue" name="Balance Due" stackId="a" fill="hsl(var(--accent))" barSize={20} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No invoice data available.</p></div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



    