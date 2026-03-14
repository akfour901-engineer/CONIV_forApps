
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, ShoppingCart, History, FileText, BarChartHorizontalBig, Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/use-auth'; 
import { useMemo } from 'react';
import type { AppConfigActionCost, AppConfigCoinPurchasePackage } from '@/types/server-only';
import { useToast } from "@/hooks/use-toast";
import { useLoading } from '@/contexts/loading-context';
import { APP_NAME } from "@/lib/constants";
import CoinsPaymentsLoadingSkeleton from './loading';
import { ACTION_COSTS_DISPLAY } from '@/lib/constants';

export default function CoinsPaymentsPage() {
  const { user, isAdmin, loading: authLoading, appConfig } = useAuth();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const isLoadingConfig = authLoading || !appConfig;

  // Correctly merge the configured costs with the display labels
  const displayActionCosts = useMemo(() => {
    if (!appConfig?.actionCosts) return [];
    
    // Create a map for quick lookup
    const costsMap = new Map(appConfig.actionCosts.map(c => [c.key, c.cost]));
    
    return ACTION_COSTS_DISPLAY
      .map(displayItem => ({
        ...displayItem,
        cost: costsMap.get(displayItem.key) ?? 0, // Fallback to 0 if not configured
      }))
      .filter(cost => cost.key !== 'DAILY_CHECK_IN_REWARD'); // Filter out the reward
  }, [appConfig]);


  const displayCoinPackages = useMemo(() => appConfig?.coinPurchasePackages || [], [appConfig]);

  if (isLoadingConfig) {
    return <CoinsPaymentsLoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center text-primary">
            <Coins className="mr-3 h-8 w-8" /> Coins & Payments
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Manage your {APP_NAME} resource points, view usage, and purchase more.
          </p>
        </div>
      </div>

      {isAdmin && isLoadingConfig && (!appConfig || (appConfig.actionCosts?.length === 0 && appConfig.coinPurchasePackages?.length === 0)) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Configuration Note</AlertTitle>
          <AlertDescription>
            The action costs and coin purchase packages are currently using default values.
            Administrators can configure these settings in the <Link href="/dashboard/admin/app-configuration" className="font-medium text-primary hover:underline">Admin Panel</Link>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/coins-payments/buy-coins" className="block hover:shadow-lg transition-shadow" onClick={() => setGlobalIsLoading(true)}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Buy Coins</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary break-words">Purchase</div>
              <p className="text-xs text-muted-foreground">Add more resource points to your account.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/coins-payments/usage-history" className="block hover:shadow-lg transition-shadow" onClick={() => setGlobalIsLoading(true)}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usage History</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary break-words">View Logs</div>
              <p className="text-xs text-muted-foreground">Track where your points are being spent.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/coins-payments/payment-history" className="block hover:shadow-lg transition-shadow" onClick={() => setGlobalIsLoading(true)}>
         <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment History</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary break-words">Transactions</div>
              <p className="text-xs text-muted-foreground">Review your past coin purchases.</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary"/> Coin Deduction Information</CardTitle>
          <CardDescription>
            Various actions within {APP_NAME} consume resource points. Here`s a general breakdown:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow>
                  <TableHead className="w-[70%]">Action</TableHead>
                  <TableHead className="text-right">Cost (Points)</TableHead>
            </TableRow></TableHeader><TableBody>
                {displayActionCosts.length > 0 ? (
                  displayActionCosts.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-right">{item.cost}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No cost information configured.</TableCell></TableRow>
                )}
            </TableBody></Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Note: These costs are based on current configuration. Specific AI features might have variable costs based on usage complexity.
            {isAdmin && " Admins can configure these in the App Configuration settings."}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><ShoppingCart className="mr-2 h-5 w-5 text-primary"/> Coin Purchase Packages</CardTitle>
          <CardDescription>
            Get more value by purchasing coins in larger amounts. Payments are processed securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount (INR)</TableHead>
                  <TableHead className="text-right">Points Awarded</TableHead>
                  <TableHead className="text-right">Effective Rate (Points/₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayCoinPackages.length > 0 ? (
                  displayCoinPackages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium">{pkg.name}</TableCell>
                      <TableCell>{pkg.description}</TableCell>
                      <TableCell className="text-right">₹{pkg.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{pkg.points}</TableCell>
                      <TableCell className="text-right">{(pkg.points / pkg.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                   <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No purchase packages configured.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
           <Button asChild className="mt-6 w-full sm:w-auto" onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/coins-payments/buy-coins">
                <span className="flex items-center"><ShoppingCart className="mr-2 h-4 w-4"/> Proceed to Buy Coins</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
