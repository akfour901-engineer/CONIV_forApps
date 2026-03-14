"use client"

import { APP_NAME } from "@/lib/constants"
import {
  Bot,
  CheckCircle,
  CreditCard,
  MessageSquare,
  Users,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Card, CardDescription, CardTitle } from "../ui/card"

interface ServiceItem {
  title: string
  description: string
  icon: LucideIcon
  href?: string
}

const whyChooseUsItems: ServiceItem[] = [
  {
    icon: Zap,
    title: "All-in-One Workflow",
    description: `From initial client contact and estimation to project execution, invoicing, and financial tracking, manage your entire business lifecycle in one integrated, intuitive platform.`,
  },
  {
    icon: Bot,
    title: "AI-Powered Insights",
    description:
      "Gain a competitive edge with AI-driven features for smarter estimates, document analysis, and risk assessment, helping you make informed decisions faster.",
  },
  {
    icon: Users,
    title: "User-Centric Design",
    description: `Designed with the contractor's daily needs in mind. ${APP_NAME} is easy to learn and simple to use, empowering you to manage your business effectively without a steep learning curve.`,
  },
  {
    icon: CreditCard,
    title: "Pay-As-You-Go",
    description:
      "No hefty subscriptions. Our resource-point system means you only pay for the features you use, making powerful tools accessible and affordable for businesses of all sizes.",
  },
  {
    icon: CheckCircle,
    title: "Comprehensive Toolkit",
    description:
      "Access everything you need: estimates, work orders, invoices, labour & inventory management, SOR rates, document storage, and advanced reporting, all in one place.",
  },
  {
    icon: MessageSquare,
    title: "Dedicated Support",
    description: `We're here to help you succeed. Get prompt assistance and guidance from our support team to make the most out of ${APP_NAME}.`,
  },
]

export function WhyUsSection() {
  return (
    <section className="w-full bg-secondary/10 py-12 md:py-20 lg:py-28">
      <div className="container mx-auto max-w-5xl px-4 md:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Why Choose {APP_NAME}?
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-lg text-muted-foreground">
            Go beyond basic project management. {APP_NAME} is the integrated
            command center for your business.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {whyChooseUsItems.map((item, index) => (
            <Card
              key={index}
              className="flex h-full flex-col items-center justify-start rounded-lg border border-primary/20 bg-card p-6 text-center shadow-md transition-shadow hover:border-primary/50 hover:shadow-xl"
            >
              <div className="mb-4 rounded-full bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                <item.icon className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="mb-2 text-xl text-foreground">
                {item.title}
              </CardTitle>
              <CardDescription className="flex-grow text-sm text-muted-foreground">
                {item.description}
              </CardDescription>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}