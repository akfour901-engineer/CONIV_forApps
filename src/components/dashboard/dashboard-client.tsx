
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import type { SummaryData, AlertItem, AdvancedReportingData, ActivityLog } from '@/types/server-only';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Coins, Gift, AlertTriangle, FileText, ClipboardList, Receipt, Award, ShieldCheck, FileCheck, CalendarClock, CalendarX2, FileClock, MailQuestion, ShoppingCart, UserRoundX, FileWarning, HandCoins, PackageSearch, UserPlus, CircleDollarSign, TrendingDown, Store, UserCog, ShieldAlert, BarChart3, HardHat, ListOrdered, Users, Building2, Map as MapIcon, Briefcase, Home as HomeIcon, TrendingUp, CreditCard, Package, MessageSquare, Wrench, Activity, RefreshCw, Sunrise } from 'lucide-react';
import { useLoading } from '@/contexts/loading-context';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LucideIcon } from 'lucide-react';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line } from 'recharts';
import  {WorkflowGraph}  from '@/components/workflow/workflow-graph';

const iconMap: { [key: string]: LucideIcon } = {
    TrendingUp, TrendingDown, ClipboardList, FileText, Users, Building2, HardHat, ListOrdered, Award, Package, MessageSquare, FileClock, Wrench, Activity
};
  
const getAlertIcon = (iconName: string): React.ElementType => {
    const alertIconMap: { [key: string]: React.ElementType } = {
        FileText, ClipboardList, Receipt, Award, Coins, ShieldCheck, FileCheck, CalendarClock, CalendarX2, FileClock, MailQuestion, ShoppingCart, UserRoundX, FileWarning, HandCoins, PackageSearch, UserPlus, CircleDollarSign, TrendingDown, Store, UserCog, ShieldAlert
    };
    return alertIconMap[iconName] || AlertTriangle;
};

const QUICK_ACTIONS = [
    { title: 'New Estimate', href: '/dashboard/estimates/new', icon: FileText },
    { title: 'New Work Order', href: '/dashboard/work-orders/new', icon: ClipboardList },
    { title: 'New Invoice', href: '/dashboard/invoices/new', icon: Receipt },
    { title: 'AI Daily Briefing', href: '/dashboard/advance-tools/ai-daily-briefing', icon: Sunrise },
    { title: 'Manage Team', href: '/dashboard/team', icon: UserCog },
    { title: 'New Expense', href: '/dashboard/expenses/new', icon: CreditCard },
];


function MiniSummaryCard({ title, value, iconName, href }: { title: string, value: string, iconName: string, href: string }) {
    const Icon = iconMap[iconName] || Coins;
    const { setIsLoading } = useLoading();
    return (
        <Link href={href} className="block hover:shadow-lg transition-shadow rounded-lg" onClick={() => setIsLoading(true)}>
            <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold break-words">{value}</div>
                </CardContent>
            </Card>
        </Link>
    );
}

function DailyCheckInCard() {
    const { user, userProfile, refreshContext } = useAuth();
    const [isClaimed, setIsClaimed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userProfile?.lastCheckInDate) {
            const today = new Date().toISOString().split('T')[0];
            if (userProfile.lastCheckInDate === today) {
                setIsClaimed(true);
            }
        }
        setIsLoading(false);
    }, [userProfile]);

    const handleCheckIn = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/user-actions/daily-check-in', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to claim reward.');
            
            await refreshContext();
            setIsClaimed(true);
        } catch (error: any) {
            // Handle error, maybe show a toast
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isLoading) {
        return <Skeleton className="h-full w-full" />;
    }

    return (
        <Card className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-lg">
            <CardHeader>
                <CardTitle>Daily Check-in Reward</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm">{isClaimed ? "You have already claimed your daily reward. Come back tomorrow!" : "Check in daily to earn free resource points to use across the app."}</p>
            </CardContent>
            <CardFooter>
                <Button variant="secondary" onClick={handleCheckIn} disabled={isClaimed || isLoading}>
                    <Gift className="mr-2 h-4 w-4" />
                    {isLoading ? "Claiming..." : (isClaimed ? "Claimed for Today" : "Claim Your Daily Points")}
                </Button>
            </CardFooter>
        </Card>
    );
}


export default function DashboardClientPage() {
    const { user, loading, dataOwnerId, isUserActuallyATeamMember, isViewingOwnAccount, setActiveContextOwnerId, currentTeamOwnerProfile, teamOwnerProfileFromInitialLoad } = useAuth();
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [woChartData, setWoChartData] = useState<any[]>([]);
    const [expenseChartData, setExpenseChartData] = useState<any[]>([]);
    const { setIsLoading: setGlobalIsLoading } = useLoading();
    const router = useRouter();


    const fetchDashboardData = useCallback(async () => {
        if (user && dataOwnerId) {
            setIsLoadingData(true);
            try {
                const idToken = await user.getIdToken();
                const [summaryRes, alertsRes, reportingRes, activityLogRes] = await Promise.all([
                    fetch(`/api/dashboard/summary?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                    fetch(`/api/alerts?dataOwnerId=${dataOwnerId}&limit=5`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                    fetch(`/api/dashboard/financial-summary?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                    fetch(`/api/dashboard/activity-log?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                ]);
                
                if (summaryRes.ok) setSummaryData(await summaryRes.json());
                if (alertsRes.ok) setAlerts(await alertsRes.json());
                if (activityLogRes.ok) {
                    const fullLog = await activityLogRes.json();
                    setActivityLog(fullLog.slice(0, 5)); // Take only the first 5 for the dashboard
                }
                
                if (reportingRes.ok) {
                    const data: AdvancedReportingData = await reportingRes.json();
                    setWoChartData(data.workOrdersData);
                    const last6Months = [...Array(6)].map((_, i) => format(new Date(new Date().setMonth(new Date().getMonth() - i)), 'yyyy-MM')).reverse();
                    const monthlyExpenses = last6Months.map(month => {
                        const monthData = data.monthlyFinancials.find((d: any) => d.month === month);
                        return { name: format(new Date(`${month}-02`), 'MMM'), expenses: monthData?.expenses || 0 };
                    });
                    setExpenseChartData(monthlyExpenses);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setIsLoadingData(false);
            }
        } else if (!loading) {
            setIsLoadingData(false);
        }
    }, [user, dataOwnerId, loading]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const formatCurrency = (amount: number | undefined | null): string => {
        if (amount === undefined || amount === null || isNaN(amount)) {
          return 'N/A';
        }
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount);
    };

    if (isLoadingData || loading) {
        return (
          <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        );
    }

    const statusColors: Record<string, string> = {
        draft: 'hsl(var(--chart-1))',
        submitted: 'hsl(var(--chart-2))',
        approved: 'hsl(var(--chart-3))',
        rejected: 'hsl(var(--chart-5))',
        expired: 'hsl(var(--chart-4))',
        pending: 'hsl(var(--chart-4))',
        'in-progress': 'hsl(var(--chart-2))',
        completed: 'hsl(var(--chart-3))',
        'on-hold': 'hsl(var(--chart-1))',
        cancelled: 'hsl(var(--chart-5))',
    };

    return (
        <div className="space-y-6">
             {isUserActuallyATeamMember && (
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                            <Briefcase className="mr-2 h-5 w-5" /> Supervisor Mode
                        </CardTitle>
                        <CardDescription>
                            You are currently managing {isViewingOwnAccount ? 'your own account' : `${currentTeamOwnerProfile?.fullName || 'the team'}'s account`}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm mb-4">
                            Switch contexts to manage either your personal data or your team`s data.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                onClick={() => {
                                    setGlobalIsLoading(true);
                                    setActiveContextOwnerId(user?.uid || null);
                                    router.refresh();
                                }}
                                disabled={isViewingOwnAccount}
                                variant={isViewingOwnAccount ? 'default' : 'outline'}
                                className="w-full sm:w-auto"
                            >
                                <HomeIcon className="mr-2 h-4 w-4"/> Switch to My Account
                            </Button>
                            <Button
                                onClick={() => {
                                    setGlobalIsLoading(true);
                                    setActiveContextOwnerId(teamOwnerProfileFromInitialLoad!.uid);
                                    router.refresh();
                                }}
                                disabled={!isViewingOwnAccount}
                                variant={!isViewingOwnAccount ? 'default' : 'outline'}
                                className="w-full sm:w-auto"
                            >
                                <Briefcase className="mr-2 h-4 w-4"/> Switch to Supervisor Mode
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-md border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center"><MapIcon className="mr-2 h-5 w-5"/>New to the app?</CardTitle>
                    <CardDescription>
                        Our comprehensive workflow guide explains every part of the application, from setup to advanced AI tools.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild onClick={() => setGlobalIsLoading(true)}>
                        <Link href="/dashboard/workflow-guide">
                        <span className="flex items-center">Open Workflow Guide <ArrowRight className="ml-2 h-4 w-4"/></span>
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {isViewingOwnAccount && <DailyCheckInCard />}


            {summaryData && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {Object.entries(summaryData).map(([key, d]: [string, any]) => (
                        <MiniSummaryCard key={key} {...d} />
                    ))}
                </div>
            )}
             
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Quick Actions</CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setIsLoadingData(true); fetchDashboardData(); }}
                        disabled={isLoadingData}
                        title="Refresh Dashboard Data"
                    >
                        <RefreshCw className={cn("h-5 w-5", isLoadingData && "animate-spin")} />
                    </Button>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map(action => (
                        <Button key={action.title} variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
                            <Link href={action.href}><action.icon className="mr-2 h-4 w-4" />{action.title}</Link>
                        </Button>
                    ))}
                </CardContent>
            </Card>

             {alerts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <AlertTriangle className="mr-2 h-5 w-5 text-destructive"/> Important Alerts
                        </CardTitle>
                        <CardDescription>
                            Recent items that may require your attention.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                       {alerts.map((alert) => {
                           const AlertIcon = getAlertIcon(alert.icon as string);
                           return (
                               <Alert key={alert.id} variant={alert.type === 'system' ? 'destructive' : 'default'}>
                                   <AlertIcon className="h-4 w-4" />
                                   <AlertTitle className="text-sm">{alert.title}</AlertTitle>
                                   <AlertDescription className="text-xs">{alert.description}</AlertDescription>
                               </Alert>
                           );
                       })}
                    </CardContent>
                    <CardFooter>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/alerts">View All Alerts <ArrowRight className="ml-2 h-4 w-4"/></Link>
                        </Button>
                    </CardFooter>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Work Orders by Status</CardTitle>
                        <CardDescription>A quick overview of your current project statuses.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={woChartData}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip formatter={(value) => `${value} projects`} cursor={{fill: 'transparent'}} />
                                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                                    {woChartData.map((d: any, index) => (
                                        <Cell key={`cell-${index}`} fill={statusColors[d.name.toLowerCase().replace(/ /g, '-')] || 'hsl(var(--primary))'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Expenses</CardTitle>
                        <CardDescription>Your expense trend over the last 6 months.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={expenseChartData}>
                                 <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                 <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                                 <Tooltip formatter={(value: any) => formatCurrency(value)} cursor={{fill: 'transparent'}}/>
                                 <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                             </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Activity className="mr-2 h-5 w-5"/> Recent Activity
                    </CardTitle>
                    <CardDescription>
                        The latest actions performed in your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     {activityLog.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[35%]">Action</TableHead>
                                        <TableHead>Actor</TableHead>
                                        <TableHead className="text-right">Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activityLog.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                <p className="font-medium text-foreground truncate max-w-xs" title={`${log.actionType.replace(/_/g, ' ')}: ${log.entityName || log.entityType}`}>
                                                    <span className="capitalize">{log.actionType.replace(/_/g, ' ')}:</span> {log.entityName || log.entityType}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{log.actorName}</TableCell>
                                            <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap" title={format(parseISO(log.timestamp), 'dd MMM yyyy, hh:mm a')}>
                                                {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No recent activity to display.</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/dashboard/advance-tools/activity-log">View Full Log <ArrowRight className="ml-2 h-4 w-4"/></Link>
                    </Button>
                </CardFooter>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Business Workflow Overview</CardTitle>
                    <CardDescription>A visual representation of the core modules and their relationships.</CardDescription>
                </CardHeader>
                <CardContent>
                    <WorkflowGraph />
                </CardContent>
            </Card>
        </div>
    );
}

    

    

