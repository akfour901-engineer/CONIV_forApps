"use client"

import { APP_NAME } from "@/lib/constants"
import { Lock, ShieldCheck, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface ServiceItem {
  title: string
  description: string
  icon: LucideIcon
  href?: string
}

const trustFactors: ServiceItem[] = [
  {
    icon: ShieldCheck,
    title: "Secure Cloud Infrastructure",
    description: `Built on Google Cloud services, leveraging its robust security infrastructure, including advanced threat protection and secure data centers to safeguard your information.`,
  },
  {
    icon: Lock,
    title: "Data Encryption Standards",
    description: `Your data is protected with end-to-end encryption, ensuring that all information transmitted and stored within ${APP_NAME} is kept confidential and secure from unauthorized access.`,
  },
  {
    icon: Users,
    title: "Controlled Data Access",
    description: `Manage who sees what with granular permissions for team members. Share specific documents or estimates with clients through secure, view-only links, putting you in control of your data.`,
  },
]

export function TrustSection() {
  return (
    <section className="w-full bg-background py-12 md:py-20 lg:py-28">
      <div className="container mx-auto max-w-5xl px-4 md:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Built on a Foundation of Trust
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
            We prioritize the safety and integrity of your business data.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {trustFactors.map((factor, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <factor.icon className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                {factor.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {factor.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}