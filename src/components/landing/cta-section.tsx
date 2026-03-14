"use client"

import { APP_NAME } from "@/lib/constants"
import { useLoading } from "@/contexts/loading-context"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from 'react'
import { Button } from "../ui/button"

export function CtaSection() {
  const { setIsLoading } = useLoading()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <section className="w-full bg-primary py-12 text-primary-foreground md:py-20 lg:py-28">
        <div className="container mx-auto max-w-3xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Revolutionize Your Contracting Business?
          </h2>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-primary py-12 text-primary-foreground md:py-20 lg:py-28">
      <div className="container mx-auto max-w-3xl px-4 text-center md:px-6">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to Revolutionize Your Contracting Business?
        </h2>
        <p className="mt-4 text-primary-foreground/80 md:text-lg">
          Stop struggling with outdated methods. Join forward-thinking
          contractors who are simplifying operations, boosting efficiency, and
          increasing profitability with {APP_NAME}.
        </p>
        <div className="mt-8">
          <Link href="/auth/signin" prefetch={false} onClick={() => setIsLoading(true)}>
            <Button
              size="lg"
              variant="secondary"
              className="h-auto px-4 py-3 text-base sm:px-8 sm:text-lg"
            >
              <span className="flex items-center whitespace-normal text-center leading-tight">
                Sign In Now & Get Started
                <ArrowRight className="ml-2 h-5 w-5 shrink-0" />
              </span>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}