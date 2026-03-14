'use client'

import { APP_NAME } from "@/lib/constants"
import { useLoading } from "@/contexts/loading-context"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from 'react'
import { Button } from "../ui/button"

export function HeroSection() {
  const { setIsLoading } = useLoading()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <section className="w-full bg-gradient-to-b from-background to-secondary/20 py-12 md:py-20 lg:py-28">
        <div className="container mx-auto max-w-5xl px-4 md:px-6">
          <div className="space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tighter text-primary sm:text-5xl md:text-6xl lg:text-7xl">
              Unlock Peak Efficiency for Your Contracting Business
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl lg:text-lg xl:text-xl">
              Tired of juggling spreadsheets, missed deadlines, and chaotic projects?
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-gradient-to-b from-background to-secondary/20 py-12 md:py-20 lg:py-28">
      <div className="container mx-auto max-w-5xl px-4 md:px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tighter text-primary sm:text-5xl md:text-6xl lg:text-7xl">
            Unlock Peak Efficiency for Your Contracting Business
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl lg:text-lg xl:text-xl">
            Tired of juggling spreadsheets, missed deadlines, and chaotic
            projects? {APP_NAME} brings clarity and control to your
            operations, from initial estimate to final invoice, empowering you
            to focus on building excellence.
          </p>
          <div className="pt-4">
            <Link href="/auth/signin" prefetch={false} onClick={() => setIsLoading(true)}>
              <Button
                size="lg"
                className="h-auto px-4 py-3 text-base sm:px-8 sm:text-lg"
              >
                <span className="flex items-center whitespace-normal text-center leading-tight">
                  Sign In & Transform Your Business
                  <ArrowRight className="ml-2 h-5 w-5 shrink-0" />
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}