"use client"

import { useLoading } from "@/contexts/loading-context"
import {
  Award,
  Building2,
  ChevronRight,
  ClipboardList,
  Coins,
  FileArchive,
  FileText,
  HardHat,
  Landmark,
  ListOrdered,
  Map as MapIcon,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserCircle,
  UserCog,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from 'react'
import { APP_NAME } from "@/lib/constants"
import { Card, CardDescription, CardTitle } from "../ui/card"

interface WorkflowStepInterface {
  step: number
  title: string
  description: string
  href: string
  icon: LucideIcon
}

const workflowSteps: WorkflowStepInterface[] = [
  {
    step: 1,
    title: "Setup Your Business",
    description: `Configure your profile, register your companies, add bank accounts, and build your client list to create a solid foundation.`,
    href: "/auth/signup",
    icon: Settings,
  },
  {
    step: 2,
    title: "Define Your Resources",
    description:
      "Build your Schedule of Rates (SOR), manage your material inventory, and register your labour force to streamline project planning.",
    href: "/auth/signup",
    icon: Package,
  },
  {
    step: 3,
    title: "Create Professional Estimates",
    description:
      "Craft detailed, accurate, and professional estimates in minutes. Impress clients and win more bids with ease.",
    href: "/auth/signup",
    icon: FileText,
  },
  {
    step: 4,
    title: "Manage Work Orders",
    description:
      "Convert approved estimates to actionable work orders or create new ones to manage project execution from start to finish.",
    href: "/auth/signup",
    icon: ClipboardList,
  },
  {
    step: 5,
    title: "Handle Procurement",
    description:
      "Create and manage Purchase Orders for materials and services, and track their status from approval to delivery.",
    href: "/auth/signup",
    icon: ShoppingCart,
  },
  {
    step: 6,
    title: "Log & Track Progress",
    description:
      "Record daily progress with DPRs, manage site visits with SVRs, and track labour attendance and payments to stay on top of project execution.",
    href: "/auth/signup",
    icon: HardHat,
  },
  {
    step: 7,
    title: "Issue & Manage Invoices",
    description:
      "Generate and send clear, professional invoices for completed work or milestones, and track their payment status.",
    href: "/auth/signup",
    icon: Receipt,
  },
  {
    step: 8,
    title: "Leverage AI-Powered Audits",
    description:
      "Utilize AI to review company activities, identify potential errors, and get data-driven suggestions for improvement and risk mitigation.",
    href: "/auth/signup",
    icon: ShieldCheck,
  },
]

function VerticalRoadmap() {
  const { setIsLoading } = useLoading()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <ol className="relative mx-auto flex max-w-xl flex-col items-center space-y-12">
        <div className="absolute left-1/2 top-0 bottom-0 z-0 w-0.5 -translate-x-1/2 transform bg-primary/30 print:hidden"></div>
        {workflowSteps.slice(0, 3).map((step, idx) => (
          <li key={idx} className="relative z-10 flex w-full max-w-xs flex-col items-center sm:max-w-sm">
            <div className="flex w-full flex-col items-center">
              <div className="mx-auto z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-md">
                {step.step}
              </div>
              <Card className="mt-4 flex h-full min-h-[180px] w-full flex-col items-center justify-center rounded-lg border border-primary/20 bg-card p-6 text-center shadow-md">
                <div className="h-8 w-8 bg-primary/20 rounded"></div>
                <CardTitle className="mb-1.5 text-lg">{step.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">{step.description}</CardDescription>
              </Card>
            </div>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <ol className="relative mx-auto flex max-w-xl flex-col items-center space-y-12">
      <div className="absolute left-1/2 top-0 bottom-0 z-0 w-0.5 -translate-x-1/2 transform bg-primary/30 print:hidden"></div>
      {workflowSteps.map((step, idx) => (
        <li
          key={idx}
          className="relative z-10 flex w-full max-w-xs flex-col items-center sm:max-w-sm"
        >
          <Link
            href={step.href}
            className="group block w-full"
            onClick={() => setIsLoading(true)}
          >
            <div className="flex w-full flex-col items-center">
              <div className="mx-auto z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-md transition-colors group-hover:bg-primary/90">
                {step.step}
              </div>
              <Card className="mt-4 flex h-full min-h-[180px] w-full flex-col items-center justify-center rounded-lg border border-primary/20 bg-card p-6 text-center shadow-md transition-shadow hover:border-primary/50 group-hover:shadow-xl">
                <step.icon className="mb-3 h-8 w-8 text-primary" />
                <CardTitle className="mb-1.5 text-lg transition-colors group-hover:text-primary/90">
                  {step.title}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {step.description}
                </CardDescription>
              </Card>
            </div>
          </Link>
          {idx !== workflowSteps.length - 1 && (
            <div className="absolute bottom-0 left-1/2 z-0 -translate-x-1/2 translate-y-6 print:hidden">
              <ChevronRight className="h-8 w-8 rotate-90 text-primary/50" />
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

export function WorkflowSection() {
  return (
    <section className="w-full bg-background py-12 md:py-20 lg:py-28">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Your Roadmap to Streamlined Contracting
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
            Follow these steps to harness the full power of {APP_NAME} and
            revolutionize your workflow.
          </p>
        </div>
        <VerticalRoadmap />
      </div>
    </section>
  )
}