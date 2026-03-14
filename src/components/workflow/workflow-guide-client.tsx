'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowGraph } from '@/components/workflow/workflow-graph';
import { useLoading } from '@/contexts/loading-context';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const manualData = [
  {
    title: "Setup Your Business",
    description: "Configure your profile, register your companies, add bank accounts, and build your client list to create a solid foundation.",
    subModules: [
      { title: "My Profile", description: "Manage your personal information, login credentials, and e-signature." },
      { title: "Companies", description: "Register and manage all your business entities." },
      { title: "Bank Accounts", description: "Store bank details for quick inclusion in invoices." },
      { title: "Manage Team", description: "Invite members, assign permissions, and manage access." },
    ],
  },
  {
    title: "Define Your Resources",
    description: "Build your Schedule of Rates (SOR), manage your material inventory, and register your labour force to streamline project planning.",
    subModules: [
      { title: "Organizations & Clients", description: "A CRM to manage client details, leads, and contacts." },
      { title: "Subcontractors", description: "Maintain a directory of your subcontractors and their specializations." },
      { title: "SOR (Schedule of Rates)", description: "A centralized library of items and rates for quick use in estimates and invoices." },
      { title: "Inventory Management", description: "Track your materials and service inventory, including quantities, pricing, and stock alerts." },
      { title: "Labour Register", description: "Oversee your entire workforce, from registration and document management to attendance and payment tracking." },
    ],
  },
  {
    title: "Create Professional Estimates",
    description: "Craft detailed, accurate, and professional estimates in minutes. Impress clients and win more bids with ease.",
    subModules: [
      { title: "New Estimate", description: "Create a new estimate from scratch or a template." },
      { title: "View All Estimates", description: "Browse, filter, and manage all your past and present estimates." },
    ],
  },
  {
    title: "Manage Work Orders",
    description: "Convert approved estimates to actionable work orders or create new ones to manage project execution from start to finish.",
    subModules: [
      { title: "New Work Order", description: "Create a new work order, either from an estimate or independently." },
      { title: "View All Work Orders", description: "Track the status and details of all your ongoing and completed projects." },
    ],
  },
  {
    title: "Handle Project Execution",
    description: "Log daily progress, manage site visits, track expenses, and handle procurement to keep your projects on track.",
    subModules: [
      { title: "Purchase Orders", description: "Streamline procurement by creating and managing purchase orders for suppliers." },
      { title: "Expense Tracking", description: "Control costs by logging and categorizing all project-related and general business expenses." },
      { title: "DPR & SVR Logging", description: "Maintain detailed site records with Daily Progress Reports and Service Visit Reports." },
      { title: "Gantt Charts & Tasks", description: "Visualize project timelines and manage individual tasks for better planning." },
      { title: "Time Tracking", description: "Log daily attendance and work hours for your labor force." },
      { title: "Project Chat", description: "Communicate with your team in real-time within the context of a specific work order." },
    ],
  },
  {
    title: "Issue & Manage Invoices",
    description: "Generate and send clear, professional invoices for completed work or milestones, and track their payment status.",
    subModules: [
      { title: "New Invoice", description: "Create a new invoice, either from a work order or independently." },
      { title: "View All Invoices", description: "Keep track of all your invoices and their payment statuses." },
    ],
  },
];


export default function WorkflowGuideClientPage() {
    const { setIsLoading } = useLoading();
    
  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-2xl font-semibold flex items-center">
                <MapIcon className="mr-3 h-7 w-7 text-primary" /> Application Manual & Workflow
            </h1>
            <p className="text-muted-foreground">
                A guide to the application`s modules and keyboard shortcuts.
            </p>
            </div>
            <Button asChild variant="outline">
            <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
            </Button>
        </div>
        
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Keyboard Shortcuts</CardTitle>
                <CardDescription>Press `Alt` + Key to quickly navigate to common pages.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">D</kbd> : Dashboard</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">E</kbd> : New Estimate</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">W</kbd> : New Work Order</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">I</kbd> : New Invoice</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">C</kbd> : New Company</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">O</kbd> : New Organization</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">M</kbd> : Manage Team</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">K</kbd> : SOR Rates</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">U</kbd> : My Profile</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">A</kbd> : Advanced Tools</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">X</kbd> : New Expense</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">N</kbd> : New Inventory Item</p>
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Application Modules Guide</CardTitle>
                <CardDescription>A detailed breakdown of each module and its purpose.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {manualData.map((item, index) => (
                        <AccordionItem value={`item-${index}`} key={index}>
                            <AccordionTrigger>{item.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-4 text-muted-foreground">{item.description}</p>
                                <ul className="space-y-3 pl-4">
                                    {item.subModules.map((sub, subIndex) => (
                                        <li key={subIndex} className="list-disc">
                                            <h4 className="font-semibold">{sub.title}</h4>
                                            <p className="text-sm text-muted-foreground">{sub.description}</p>
                                        </li>
                                    ))}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
        
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Interactive Workflow</CardTitle>
                <CardDescription>Click on a main step to expand or collapse its sub-modules. Click on a sub-module to navigate to its page.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                <WorkflowGraph />
            </CardContent>
        </Card>
    </div>
  );
}
