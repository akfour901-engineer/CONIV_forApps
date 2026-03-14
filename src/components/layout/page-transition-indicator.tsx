
"use client"

import { useLoading } from "@/contexts/loading-context"
import * as React from "react"

export function PageTransitionIndicator() {
  const { isLoading } = useLoading()

  // This component now directly reflects the global loading state.
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        backgroundColor: "hsl(var(--accent))",
        zIndex: 9999,
        width: isLoading ? "100%" : "0%",
        opacity: isLoading ? 1 : 0,
        transition: isLoading
          ? "width 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)"
          : "width 0.3s ease-out 0.5s, opacity 0.3s ease-out 0.5s",
        pointerEvents: "none",
      }}
      aria-hidden={!isLoading}
      role="progressbar"
      aria-valuenow={isLoading ? 100 : 0}
    />
  )
}
