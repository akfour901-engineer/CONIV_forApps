'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, Loader2, Search, ArrowDownUp, FileText, ClipboardList, Receipt, Award, Coins, ShieldCheck, FileCheck, CalendarClock, CalendarX2, FileClock, MailQuestion, ShoppingCart, UserRoundX, FileWarning, HandCoins, PackageSearch, UserPlus, CircleDollarSign, TrendingDown, Store, UserCog, ShieldAlert, BarChart3, HardHat, ListOrdered, Users, Building2, Map as MapIcon, Briefcase, Home as HomeIcon, TrendingUp, CreditCard, Package, MessageSquare, Wrench, Activity, RefreshCw, Sunrise, Bell } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/use-auth';
import type { AlertItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import AllAlertsLoadingSkeleton from '@/app/dashboard/alerts/loading';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { showAlertNotification } from '@/lib/notifications'; // ← NEW IMPORT
import { requestNotificationPermission } from '@/lib/notification-permission'

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return `${format(date, 'dd MMM yyyy')} (${formatDistanceToNow(date, { addSuffix: true })})`;
  } catch (e) {
    return 'Invalid Date';
  }
};

const getAlertIcon = (iconName: string): React.ElementType => {
  const alertIconMap: { [key: string]: React.ElementType } = {
    FileText, ClipboardList, Receipt, Award, Coins, ShieldCheck, FileCheck, CalendarClock, CalendarX2, FileClock, MailQuestion, ShoppingCart, UserRoundX, FileWarning, HandCoins, PackageSearch, UserPlus, CircleDollarSign, TrendingDown, Store, UserCog, ShieldAlert
  };
  return alertIconMap[iconName] || AlertTriangle;
};

const ALERT_TYPES = ['all', 'estimate', 'workOrder', 'invoice', 'license', 'purchaseOrder', 'labour', 'team', 'inventory', 'system', 'organization', 'financial', 'follow-up'];

export default function AllAlertsClientPage() {
  const { user, userProfile, loading: authLoading, dataOwnerId } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const previousAlertsRef = useRef<AlertItem[]>([]);
  const [notificationPermission, setNotificationPermission] = useState('default');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AlertItem; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const hasLowPoints = useMemo(() => (userProfile?.resourcePoints ?? 0) < 700, [userProfile]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotificationPermission = async () => {
    const permission = await requestNotificationPermission()
  
    setNotificationPermission(permission)
  
    if (permission === 'granted') {
      toast({
        title: 'Notifications Enabled!',
        description: 'You will now receive alerts.',
      })
    } else {
      toast({
        title: 'Notifications Blocked',
        description: 'Please enable from settings.',
        variant: 'destructive',
      })
    }
  }
  

  const fetchAlerts = useCallback(async () => {
    if (!user || !dataOwnerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/alerts?dataOwnerId=${dataOwnerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      const newAlertsData: AlertItem[] = await response.json();

      // Show notifications for new alerts
      if (previousAlertsRef.current.length > 0 && newAlertsData.length > previousAlertsRef.current.length) {
        const previouslySeenIds = new Set(previousAlertsRef.current.map(a => a.id));
        const newAlerts = newAlertsData.filter(alert => !previouslySeenIds.has(alert.id));

        if (newAlerts.length > 0 && Notification.permission === 'granted') {
          newAlerts.forEach(notification => {
            showAlertNotification({
              title: notification.title,
              message: notification.description,
              alertId: notification.id,
              priority: (notification as any).priority || 'normal'   // ← FIXED: safe access with fallback
            });
          });
        }
      }
      
      setAlerts(newAlertsData);
      previousAlertsRef.current = newAlertsData;
    } catch (error: any) {
      console.error("Error fetching alerts:", error);
      toast({ title: "Error Loading Alerts", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, dataOwnerId, toast]);

  useEffect(() => {
    if (!authLoading && dataOwnerId) {
      fetchAlerts(); // Initial fetch
      
      const interval = setInterval(() => {
        fetchAlerts();
      }, 2 * 60 * 1000); // Poll every 2 minutes

      return () => clearInterval(interval);
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, dataOwnerId, fetchAlerts]);
  
  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('_') as [keyof AlertItem, 'asc' | 'desc'];
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredAlerts = useMemo(() => {
    return alerts
      .filter(alert => typeFilter === 'all' || alert.type === typeFilter)
      .filter(alert => 
        alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.type.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const aValue = a[sortConfig.key]; 
        const bValue = b[sortConfig.key];
        if (!aValue || !bValue) return 0;
        if (sortConfig.key === 'date') {
          return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
  }, [alerts, searchTerm, sortConfig, typeFilter]);

  const totalPages = Math.ceil(sortedAndFilteredAlerts.length / itemsPerPage);
  const paginatedAlerts = sortedAndFilteredAlerts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading || authLoading) {
    return <AllAlertsLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <AlertTriangle className="mr-3 h-7 w-7 text-primary" /> All Alerts
          </h1>
          <p className="text-muted-foreground">
            A comprehensive list of all system notifications and actionable alerts.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <span className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </span>
          </Link>
        </Button>
      </div>

      {hasLowPoints && (
        <Alert variant="destructive">
          <Coins className="h-4 w-4" />
          <AlertTitle>Email Notifications At Risk</AlertTitle>
          <AlertDescription>
            Your email-based notifications might not be delivered because your resource point balance is below 700. Please{' '}
            <Link href="/dashboard/coins-payments/buy-coins" className="font-semibold underline hover:text-destructive/80">
              get more points
            </Link>
            {' '}or manage your preferences in{' '}
            <Link href="/dashboard/settings" className="font-semibold underline hover:text-destructive/80">
              Settings
            </Link>.
          </AlertDescription>
        </Alert>
      )}

      {notificationPermission === 'default' && (
        <Alert>
          <Bell className="h-4 w-4" />
          <AlertTitle>Enable Notifications</AlertTitle>
          <AlertDescription>
            Get real-time updates for important events.
            <Button onClick={handleRequestNotificationPermission} size="sm" className="ml-4">Enable</Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Notifications & Alerts</CardTitle>
          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all')}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="Filter by Type" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {ALERT_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'date_desc'}>
              <SelectTrigger className="w-full md:w-[180px]">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4" />
                  <SelectValue placeholder="Sort by..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date: Newest</SelectItem>
                <SelectItem value="date_asc">Date: Oldest</SelectItem>
                <SelectItem value="title_asc">Title (A-Z)</SelectItem>
                <SelectItem value="type_asc">Type (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell w-[40%]">Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAlerts.length > 0 ? (
                  paginatedAlerts.map(alert => {
                    const AlertIcon = getAlertIcon(alert.icon as string);
                    return (
                      <TableRow key={alert.id}>
                        <TableCell><AlertIcon className="h-5 w-5 text-muted-foreground"/></TableCell>
                        <TableCell className="font-medium">{alert.title}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{alert.description}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(alert.date)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm" onClick={() => setGlobalIsLoading(true)}>
                            <Link href={alert.href}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">No alerts found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-2">
          <DataTablePagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
            itemsPerPage={itemsPerPage} 
            onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }} 
            canPreviousPage={currentPage > 1} 
            canNextPage={currentPage < totalPages} 
            itemCount={alerts.length} 
            filteredItemCount={sortedAndFilteredAlerts.length}
          />
        </CardFooter>
      </Card>
    </div>
  );
}