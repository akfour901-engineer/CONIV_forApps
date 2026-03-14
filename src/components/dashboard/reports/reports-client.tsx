
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChart3, TrendingUp, HardHat, PieChart, Target, Package } from 'lucide-react';
import { useLoading } from '@/contexts/loading-context';

const reports = [
  {
    title: "Financial Summary",
    description: "An overview of revenue, expenses, and profitability across your projects.",
    href: "/dashboard/financial-summary",
    icon: BarChart3
  },
  {
    title: "Work Order Profitability",
    description: "Analyze the profitability of each individual work order.",
    href: "/dashboard/reports/work-order-profitability",
    icon: TrendingUp,
  },
  {
    title: "Labour Cost Analysis",
    description: "Compare labour costs against project budgets to identify variances.",
    href: "/dashboard/reports/labour-cost-analysis",
    icon: HardHat,
  },
  {
    title: "Estimate vs. Actuals",
    description: "Track how your actual project costs compare against your initial estimates.",
    href: "/dashboard/reports/estimate-vs-actuals",
    icon: Target,
  },
  {
    title: "DPR Summary",
    description: "Generate a consolidated summary of Daily Progress Reports for a selected period.",
    href: "/dashboard/dpr-summary",
    icon: PieChart,
  },
   {
    title: "Materials Consumption",
    description: "Summarizes all materials consumed from DPRs and SVRs for a given period.",
    href: "/dashboard/reports/materials-consumption",
    icon: Package,
  },
];

export default function ReportsClientPage() {
    const { setIsLoading } = useLoading();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Gain insights into your business performance with detailed reports.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.title} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <report.icon className="mr-2 h-6 w-6 text-primary" />
                {report.title}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow" />
            <CardFooter>
              <Button asChild className="w-full" onClick={() => setIsLoading(true)}>
                <Link href={report.href}>View Report</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
