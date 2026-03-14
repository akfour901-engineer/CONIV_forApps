'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WorkflowGraph } from '@/components/workflow/workflow-graph';

const manualData = [
  {
    title: "Setup Your Business",
    description: "Configure your profile, register your companies, add bank accounts, and build your client list to create a solid foundation.",
    subModules: [
      { 
        title: "My Profile", 
        description: "Manage your personal information, login credentials, and e-signature.",
        howTo: "1. From the user menu in the top-right corner, select 'Profile'.\n2. Here you can edit your name, contact information, and upload a profile picture or e-signature image.\n3. Click 'Save Profile Changes' when done."
      },
      { 
        title: "Companies", 
        description: "Register and manage all your business entities.",
        howTo: "1. Navigate to the 'Companies' page from the sidebar.\n2. Click 'Add New Company' and fill in the required details like company name and address.\n3. This information will be used on your estimates, work orders, and invoices."
      },
      { 
        title: "Bank Accounts", 
        description: "Store bank details for quick inclusion in invoices.",
        howTo: "1. Go to the 'Bank Accounts' page.\n2. Click 'Add New Account' to securely store your bank details.\n3. You can set one account as the default to have it automatically appear on your invoices."
      },
      { 
        title: "Manage Team", 
        description: "Invite members, assign permissions, and manage access.",
        howTo: "1. From the 'Team' page, you can invite new members via email or phone.\n2. After inviting, you can click 'Manage Permissions' for each member to control exactly what sections and actions they can access."
      },
    ],
  },
  {
    title: "Define Your Resources",
    description: "Build your Schedule of Rates (SOR), manage your material inventory, and register your labour force to streamline project planning.",
    subModules: [
      { 
        title: "Organizations & Clients", 
        description: "A CRM to manage client details, leads, and contacts.",
        howTo: "1. Go to the 'Organizations' page to add new clients or manage existing ones.\n2. You can specify their type, status, and contact information.\n3. This is your central customer relationship management (CRM) hub."
      },
      { 
        title: "Subcontractors", 
        description: "Maintain a directory of your subcontractors and their specializations.",
        howTo: "1. Navigate to 'Subcontractors' under 'Advance Tools'.\n2. Add your subcontractors here to easily select them when creating Purchase Orders for services."
      },
      { 
        title: "SOR (Schedule of Rates)", 
        description: "A centralized library of items and rates for quick use in estimates and invoices.",
        howTo: "1. Access the 'SOR Rates' page.\n2. Here you can pre-define line items with descriptions, units, and rates.\n3. When creating an estimate, you can then quickly search and add these items."
      },
      { 
        title: "Inventory Management", 
        description: "Track your materials and service inventory, including quantities, pricing, and stock alerts.",
        howTo: "1. On the 'Inventory' page, add items you stock.\n2. You can then 'Issue' items to projects (which logs an expense) or 'Receive' new stock.\n3. Set low-stock alerts to be notified when you need to reorder."
      },
      { 
        title: "Labour Register", 
        description: "Oversee your entire workforce, from registration and document management to attendance and payment tracking.",
        howTo: "1. Go to the 'Labour Register' to add workers.\n2. You must link each labourer to a Work Order.\n3. You can manage their documents, track their attendance, and record advance payments."
      },
    ],
  },
  {
    title: "Create Professional Estimates",
    description: "Craft detailed, accurate, and professional estimates in minutes. Impress clients and win more bids with ease.",
    subModules: [
      { 
        title: "New Estimate", 
        description: "Create a new estimate from scratch, from an AI suggestion, or a template.",
        howTo: "1. Click 'New Estimate'.\n2. Select your company and client.\n3. You can manually add items, or search for pre-defined items from your SOR.\n4. Once sent to the client, the status can be updated to 'Approved' or 'Rejected'."
      },
      { 
        title: "View All Estimates", 
        description: "Browse, filter, and manage all your past and present estimates.",
        howTo: "1. On the 'Estimates' page, you can see a list of all your created estimates.\n2. Use the search and filter options to find specific documents.\n3. From here you can also edit, download, or delete estimates."
      },
    ],
  },
  {
    title: "Manage Work Orders",
    description: "Convert approved estimates to actionable work orders or create new ones to manage project execution from start to finish.",
    subModules: [
      { 
        title: "New Work Order", 
        description: "Create a new work order, either from an estimate or independently.",
        howTo: "1. Click 'New Work Order'.\n2. You can start fresh or select an approved estimate to automatically pre-fill all the details.\n3. The Work Order is the central document for managing project execution."
      },
      { 
        title: "View All Work Orders", 
        description: "Track the status and details of all your ongoing and completed projects.",
        howTo: "1. The 'Work Orders' page lists all projects.\n2. From here, you can view project details, create invoices, log expenses, add labour, and perform many other actions related to a specific project."
      },
    ],
  },
  {
    title: "Handle Project Execution",
    description: "Log daily progress, manage site visits, track expenses, and handle procurement to keep your projects on track.",
    subModules: [
      { 
        title: "Purchase Orders", 
        description: "Streamline procurement by creating and managing purchase orders for suppliers.",
        howTo: "1. From 'Advanced Tools', go to 'Purchase Orders'.\n2. Create new POs and link them to projects.\n3. This helps track procurement costs separately."
      },
      { 
        title: "Expense Tracking", 
        description: "Control costs by logging and categorizing all project-related and general business expenses.",
        howTo: "1. On the 'Expenses' page, click 'Add New Expense' to log any cost.\n2. You can categorize it and optionally link it to a specific Work Order to track project-specific costs."
      },
      { 
        title: "DPR & SVR Logging", 
        description: "Maintain detailed site records with Daily Progress Reports and Service Visit Reports.",
        howTo: "1. Use the 'DPR' and 'SVR' sections to log daily site activities and service visits.\n2. These reports can be linked to Work Orders for comprehensive project tracking and documentation."
      },
      { 
        title: "Gantt Charts & Tasks", 
        description: "Visualize project timelines and manage individual tasks for better planning.",
        howTo: "1. Go to 'Gantt Charts' under 'Advanced Tools'.\n2. Select a Work Order, and you can add tasks with start/end dates.\n3. Use the AI generator to automatically create a schedule based on your Work Order's scope."
      },
      { 
        title: "Time Tracking", 
        description: "Log daily attendance and work hours for your labor force.",
        howTo: "1. Go to 'Time Tracking' under 'Advanced Tools'.\n2. Select a Work Order and a month to see a grid of all labourers on that project.\n3. Click any cell to log hours or mark attendance for a specific day."
      },
      { 
        title: "Project Chat", 
        description: "Communicate with your team in real-time within the context of a specific work order.",
        howTo: "1. Go to 'Project Chat', select a Work Order, and start messaging.\n2. All team members with permission can see and participate in the chat for that project."
      },
    ],
  },
  {
    title: "Issue & Manage Invoices",
    description: "Generate and send clear, professional invoices for completed work or milestones, and track their payment status.",
    subModules: [
      { 
        title: "New Invoice", 
        description: "Create a new invoice, either from a work order or independently.",
        howTo: "1. Click 'New Invoice'.\n2. You can pre-fill details from a completed Work Order or create a standalone invoice.\n3. Add items, tax, and payment instructions before sending it to your client."
      },
      { 
        title: "View All Invoices", 
        description: "Keep track of all your invoices and their payment statuses.",
        howTo: "1. The 'Invoices' page shows all created invoices.\n2. You can update their status (e.g., to 'Paid'), download them as PDFs, or attach proof of payment."
      },
    ],
  },
];


export default function WorkflowGuideClientPage() {
    
  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-2xl font-semibold flex items-center">
                <MapIcon className="mr-3 h-7 w-7 text-primary" /> Application Manual & Workflow
            </h1>
            <p className="text-muted-foreground">
                An interactive guide to the application’s modules.
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
                <CardTitle>Application Modules Guide</CardTitle>
                <CardDescription>A detailed breakdown of each module and its purpose. Expand each section to learn more.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {manualData.map((item, index) => (
                        <AccordionItem value={`item-${index}`} key={index}>
                            <AccordionTrigger className="text-lg">{item.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-4 text-muted-foreground">{item.description}</p>
                                <Accordion type="single" collapsible className="w-full pl-4 border-l">
                                    {item.subModules.map((sub, subIndex) => (
                                        <AccordionItem value={`sub-item-${index}-${subIndex}`} key={subIndex} className="border-b-0">
                                            <AccordionTrigger className="text-left font-semibold text-md py-2 hover:no-underline">{sub.title}</AccordionTrigger>
                                            <AccordionContent>
                                                <p className="text-sm text-muted-foreground pb-2">{sub.description}</p>
                                                <div className="prose prose-sm max-w-none text-muted-foreground rounded-md border bg-secondary/50 p-3">
                                                    <h5 className="font-bold text-foreground">How to use:</h5>
                                                    <p className="whitespace-pre-line">{sub.howTo}</p>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>

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
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">L</kbd> : Labour Register</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">S</kbd> : Settings</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">P</kbd> : Purchase Orders</p>
                    <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt</kbd> + <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F</kbd> : Follow-ups</p>
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Interactive Workflow</CardTitle>
                <CardDescription>This diagram shows how the core modules connect. It is interactive!</CardDescription>
            </CardHeader>
            <CardContent>
                <WorkflowGraph />
            </CardContent>
        </Card>

    </div>
  );
}
