'use client';

import { 
  UserCog, ScanSearch, ShieldCheck, Sparkles, HardHat, FileArchive, Award, ListOrdered, Link as LinkIcon, CreditCard, ShoppingCart, Package, Activity, QrCode, Wrench, FileClock, Bot, Users, Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { useLoading } from '@/contexts/loading-context';

interface ServiceItem {
    title: string;
    description: string;
    icon: LucideIcon;
    href?: string;
}

const advancedCapabilities: ServiceItem[] = [
    { icon: UserCog, title: "Team Access Management", description: "Collaborate seamlessly by inviting team members, assigning granular permissions, and managing supervisor access to streamline workflows securely.", href:"/dashboard/team" },
    { icon: ScanSearch, title: "AI-Powered Document Processing & OCR", description: "Automate data entry. Let advanced AI extract key information from uploaded documents like invoices and plans, saving you hours.", href:"/dashboard/advance-tools/ai-document-analysis" },
    { icon: ShieldCheck, title: "Automated Audit Tool", description: "Gain deep financial insights. Our AI reviews your records, identifies potential errors, and suggests data-driven corrections for compliance and efficiency.", href:"/dashboard/advance-tools/audit" },
    { icon: Workflow, title: "AI Portfolio Generator", description: "Automatically create a professional public-facing portfolio page based on your company's completed projects to showcase your work.", href:"/dashboard/advance-tools/ai-portfolio-generator" },
];

const comprehensiveTools: ServiceItem[] = [
    { icon: HardHat, title: "Labour Management", description: "Oversee your entire workforce, from registration and document management to attendance and payment tracking.", href: "/dashboard/labour-register" },
    { icon: Users, title: "Subcontractor Management", description: "Keep a directory of your trusted subcontractors, their specializations, and contact information for quick project allocation.", href: "/dashboard/subcontractors" },
    { icon: Package, title: "Inventory Management", description: "Track stock. Manage your materials and service inventory, including quantities, pricing, and stock alerts.", href: "/dashboard/inventory" },
    { icon: ShoppingCart, title: "Purchase Order Management", description: "Streamline procurement. Create, send, and track purchase orders to your suppliers efficiently.", href: "/dashboard/advance-tools/purchase-orders" },
    { icon: CreditCard, title: "Expense Tracking", description: "Control costs. Log and categorize all your business expenses for better financial management.", href: "/dashboard/expenses" },
    { icon: FileClock, title: "DPR & SVR Logging", description: "Maintain detailed site records with Daily Progress Reports and Service Visit Reports for compliance and tracking.", href: "/dashboard/dpr"},
    { icon: FileArchive, title: "Document Management", description: "Keep all your project-related files secure, organized, and linked to specific work orders for easy access.", href: "/dashboard/documents" },
    { icon: Award, title: "Manage Licenses", description: "Stay compliant. Track all business and professional licenses, ensuring timely renewals and easy access.", href: "/dashboard/licenses" },
    { icon: ListOrdered, title: "Manage SOR Rates", description: "Standardize your pricing. Build and maintain your Schedule of Rates for accurate estimates and work orders.", href: "/dashboard/sor-rates" },
    { icon: Activity, title: "Activity Log", description: "Stay informed. View a detailed log of all significant activities and changes within your account.", href: "/dashboard/advance-tools/activity-log" },
    { icon: QrCode, title: "Digital Business Cards", description: "Network effectively. Create and share professional digital contact cards with unique QR codes.", href: "/dashboard/advance-tools/qr-business-card" },
    { icon: LinkIcon, title: "Client Portal (Estimates & Invoices)", description: "Share securely. Provide clients with view-only access to their estimates and invoices via shareable links.", href: "/dashboard/invoices" },
];

export function CapabilitiesSection() {
    const { setIsLoading } = useLoading();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <>
            <section className="w-full py-12 md:py-20 lg:py-28 bg-primary/5">
                <div className="container px-4 md:px-6 max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary flex items-center justify-center">
                        <Sparkles className="mr-3 h-8 w-8 text-amber-500" />
                        Advanced Capabilities to Supercharge Your Business
                    </h2>
                    </div>
                </div>
            </section>
            <section className="w-full py-12 md:py-20 lg:py-28 bg-background">
                <div className="container px-4 md:px-6 max-w-7xl mx-auto">
                    <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary">Comprehensive Tools for Every Need</h2>
                    </div>
                </div>
            </section>
            </>
        );
    }

    return (
        <>
        <section className="w-full py-12 md:py-20 lg:py-28 bg-primary/5">
            <div className="container px-4 md:px-6 max-w-5xl mx-auto">
                <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary flex items-center justify-center">
                    <Sparkles className="mr-3 h-8 w-8 text-amber-500" />
                    Advanced Capabilities to Supercharge Your Business
                </h2>
                <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">Elevate your operations with our specialized suite of intelligent and powerful tools, designed for the modern contractor.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                {advancedCapabilities.map((service, index) => (
                    <Link key={index} href={service.href || "/auth/signup"} className="block group h-full" onClick={() => setIsLoading(true)}>
                    <Card className="bg-card rounded-lg p-6 shadow-lg text-center flex flex-col items-center justify-start hover:shadow-primary/20 transition-all duration-300 hover:border-primary h-full border border-primary/30 group">
                        <div className="p-3 rounded-full bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                        <service.icon className="w-10 h-10 text-primary" />
                        </div>
                        <CardTitle className="text-xl mb-2 text-primary group-hover:text-primary/90">{service.title}</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground flex-grow">{service.description}</CardDescription>
                    </Card>
                    </Link>
                ))}
                </div>
            </div>
        </section>
        <section className="w-full py-12 md:py-20 lg:py-28 bg-background">
            <div className="container px-4 md:px-6 max-w-7xl mx-auto">
                <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary">Comprehensive Tools for Every Need</h2>
                <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">Our platform is packed with features designed to cover all aspects of your contracting business, ensuring you have the right tool for every job.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {comprehensiveTools.map((service, index) => (
                    <Link key={index} href={service.href || "/auth/signup"} className="block group h-full" onClick={() => setIsLoading(true)}>
                    <Card className="bg-card rounded-lg p-6 shadow-lg text-center flex flex-col items-center justify-start hover:shadow-primary/20 transition-all duration-300 hover:border-primary h-full border border-primary/20">
                        <div className="p-3 rounded-full bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                        <service.icon className="w-8 h-8 text-primary/80" />
                        </div>
                        <CardTitle className="text-lg mb-2 text-primary/90 group-hover:text-primary">{service.title}</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground flex-grow">{service.description}</CardDescription>
                    </Card>
                    </Link>
                ))}
                </div>
            </div>
        </section>
        </>
    )
}