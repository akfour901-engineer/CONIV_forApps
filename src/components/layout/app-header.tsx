
"use client"

import { useAuth } from "@/hooks/use-auth"
import { NAV_ITEMS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Coins } from "lucide-react"
import { usePathname } from "next/navigation"

import { UserNav } from "./user-nav"

export function AppHeader() {
  const pathname = usePathname() ?? '/';
  const {
    user,
    userProfile,
    loading: authLoading,
    currentTeamOwnerProfile,
    isViewingOwnAccount,
  } = useAuth()

  const currentNavItem = NAV_ITEMS.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href))
  )
  const pageTitle = currentNavItem ? currentNavItem.title : "Dashboard"

  const contextResourcePoints = isViewingOwnAccount
    ? userProfile?.resourcePoints
    : currentTeamOwnerProfile?.resourcePoints
  const showPoints = contextResourcePoints !== undefined

  if (authLoading || !userProfile) {
    return (
        <header className="sticky top-0 z-20 flex h-12 items-center gap-4 border-b bg-background/80 px-3 backdrop-blur-md sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1 overflow-hidden">
                <Skeleton className="h-5 w-32" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-20 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
        </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex-1 overflow-hidden">
        <h1 className="truncate text-base font-semibold">
          {pageTitle}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {showPoints ? (
          <div className="flex items-center rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs text-foreground shadow-sm">
            <Coins className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
            <span>{contextResourcePoints}</span>
          </div>
        ) : (
          <div className="flex items-center rounded-md border border-red-500/50 bg-red-50/50 px-2 py-1 text-xs text-red-500 shadow-sm">
            <Coins className="mr-1.5 h-3.5 w-3.5 text-red-500" />
            <span>N/A</span>
          </div>
        )}
        <UserNav />
      </div>
    </header>
  )
}
