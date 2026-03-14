'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, MessageSquare, Users, CreditCard, ArrowRight, AlertTriangle, Mail } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LucideIcon } from 'lucide-react';
import { useLoading } from '@/contexts/loading-context';

interface AdminTool {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  displayOrder: number;
}

const adminTools: AdminTool[] = [
  {
    title: "App Configuration",
    description: "Manage points, costs, coin packages, and site-wide banners.",
    icon: Settings,
    href: "/dashboard/admin/app-configuration",
    displayOrder: 1,
  },
  {
    title: "User Management",
    description: "View a list of all registered users and their details.",
    icon: Users,
    href: "/dashboard/admin/user-management",
    displayOrder: 2,
  },
  {
    title: "User Submissions",
    description: "View and manage user feedback, queries, and complaints.",
    icon: MessageSquare,
    href: "/dashboard/admin/user-submissions",
    displayOrder: 3,
  },
  {
    title: "Payment Tracking",
    description: "Monitor coin purchase and support transactions across the system.",
    icon: CreditCard,
    href: "/dashboard/admin/payment-tracking",
    displayOrder: 4,
  },
  {
    title: "Mailing List",
    description: "Manage contractor emails for outreach. Auto-logs new signups.",
    icon: Mail,
    href: "/dashboard/admin/mailing-list",
    displayOrder: 5,
  },
];

export default function AdminDashboardPage() {
  const { user, isAdmin, loading } = useAuth();
  const [sortOrder, setSortOrder] = useState<'default' | 'alphabetical'>('default');
  const { setIsLoading } = useLoading();

  const sortedAdminTools = useMemo(() => {
    const tools = [...adminTools];
    if (sortOrder === 'alphabetical') {
      return tools.sort((a, b) => a.title.localeCompare(b.title));
    }
    // Default sort by displayOrder
    return tools.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [sortOrder]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Admin Panel</h1>
        <p>Loading user authorization...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to access the Admin Panel.</p>
            <Button asChild className="mt-6">
            <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
        </div>
    );
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center text-primary">
          <Settings className="mr-3 h-8 w-8" /> Admin Panel
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Oversee and configure application settings and user interactions.
        </p>
      </div>

      <div className="flex justify-end">
        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'default' | 'alphabetical')}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="default">Default Order</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sortedAdminTools.map((tool) => (
          <Card key={tool.title} className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <tool.icon className="mr-3 h-6 w-6 text-primary" />
                {tool.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{tool.description}</CardDescription>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full" onClick={() => setIsLoading(true)}>
                <Link href={tool.href}>
                  Go to {tool.title} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
