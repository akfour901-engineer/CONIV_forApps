
"use client"

import { useAuth } from "@/hooks/use-auth"
import {
  Briefcase,
  Home as HomeIcon,
  LayoutDashboard,
  PanelLeft,
  UserCircle,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useLoading } from "@/contexts/loading-context"

interface NavLink {
  href?: string
  label: string
  icon: React.ElementType
  isTrigger?: boolean
  isContextSwitcher?: boolean
  isProfileLink?: boolean
}

export function BottomNavBar() {
  const pathname = usePathname() ?? '/';
  const router = useRouter()
  const { setIsLoading } = useLoading()
  const {
    user,
    userProfile,
    activeContextOwnerId,
    setActiveContextOwnerId,
    currentTeamOwnerProfile,
    isUserActuallyATeamMember,
    isViewingOwnAccount,
    teamOwnerProfileFromInitialLoad,
  } = useAuth()

  const handleNavigation = (href: string) => {
    if (pathname !== href) {
        setIsLoading(true);
    }
  }

  const handleSwitchContext = (targetOwnerId: string | null) => {
    if (!targetOwnerId || targetOwnerId === activeContextOwnerId) return

    setActiveContextOwnerId(targetOwnerId)

    // Always navigate to dashboard on context switch for a clean state.
    router.push("/dashboard")
  }

  const navLinks: NavLink[] = [
    { isTrigger: true, label: "Menu", icon: PanelLeft },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
    { isProfileLink: true, label: "Profile", icon: UserCircle },
  ]

  const currentContextName = isViewingOwnAccount
    ? "My Account"
    : currentTeamOwnerProfile?.fullName ||
      currentTeamOwnerProfile?.email ||
      `Team Account`

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background shadow-top md:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-stretch justify-around px-1 sm:px-2">
        {navLinks.map((link) => {
          if (link.isTrigger) {
            return (
              <SidebarTrigger
                asChild
                key={link.label}
                className="flex h-full flex-1 flex-col items-center justify-center p-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary/90 focus:text-primary/90 focus:outline-none focus:ring-0"
              >
                <Button variant="ghost" aria-label="Toggle sidebar" title="Menu">
                  <link.icon className="mb-1 h-5 w-5" />
                  <span>{link.label}</span>
                </Button>
              </SidebarTrigger>
            )
          }

          if (link.isContextSwitcher) {
            if (!isUserActuallyATeamMember) return null
            return (
              <DropdownMenu key={link.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex h-full flex-1 flex-col items-center justify-center p-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary/90 focus-visible:ring-0 focus-visible:ring-offset-0"
                    aria-label="Switch Account Context"
                    title={`Managing: ${currentContextName}`}
                  >
                    <link.icon className="mb-1 h-5 w-5" />
                    <span className="max-w-[70px] truncate">
                      {currentContextName}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center" className="mb-2 w-56">
                  <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleSwitchContext(user!.uid)}
                    disabled={isViewingOwnAccount}
                  >
                    <HomeIcon className="mr-2 h-4 w-4" />
                    <span>Manage My Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleSwitchContext(teamOwnerProfileFromInitialLoad!.uid)
                    }
                    disabled={!isViewingOwnAccount}
                  >
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span>
                      Manage Team:{" "}
                      {teamOwnerProfileFromInitialLoad?.fullName ||
                        teamOwnerProfileFromInitialLoad?.email}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }

          if (link.isProfileLink) {
            if (!user) return null
            const profileHref = "/dashboard/profile";
            return (
              <Link
                key={link.label}
                href={profileHref}
                aria-label={link.label}
                title={link.label}
                className="flex flex-1 flex-col items-center justify-center p-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary/90"
                onClick={() => handleNavigation(profileHref)}
              >
                <link.icon className="mb-1 h-5 w-5" />
                <span className="truncate">{link.label}</span>
              </Link>
            )
          }

          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href!))

          return (
            <Link
              key={link.href}
              href={link.href!}
              aria-label={link.label}
              title={link.label}
              className={cn(
                "flex flex-1 flex-col items-center justify-center p-1 text-xs font-medium transition-colors h-full",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary/90"
              )}
              onClick={() => handleNavigation(link.href!)}
            >
              <link.icon
                className={cn(
                  "h-5 w-5 mb-1",
                  isActive ? "text-primary" : ""
                )}
              />
              <span className="truncate">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
