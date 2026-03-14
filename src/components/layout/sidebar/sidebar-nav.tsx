
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { FC } from "react"
import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/hooks/use-auth"
import { ChevronRight, type LucideIcon } from "lucide-react"
import * as React from "react"
import { InstallPwaButton } from "../../ui/install-pwa-button"
import { NAV_ITEMS } from "@/lib/constants"
import { useLoading } from "@/contexts/loading-context"
import { getIcon } from "@/components/icons"

export const SidebarNav: FC = () => {
  const pathname = usePathname() ?? '/';
  const { userProfile, isAdmin } = useAuth()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const { setIsLoading } = useLoading();
  const [openSubMenus, setOpenSubMenus] = React.useState<
    Record<string, boolean>
  >(() => {
    const initialOpenState: Record<string, boolean> = {}
    NAV_ITEMS.forEach((item) => {
      if (item.children && item.children.length > 0) {
        initialOpenState[item.title] = true
      }
    })
    return initialOpenState
  })

  const toggleSubMenu = (title: string) => {
    setOpenSubMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  React.useEffect(() => {
    const activeParent = NAV_ITEMS.find(
      (item) =>
        item.children &&
        item.children.some((child) => pathname.startsWith(child.href))
    )
    if (activeParent && !openSubMenus[activeParent.title]) {
      setOpenSubMenus((prev) => ({
        ...prev,
        [activeParent.title]: true,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  
  const handleNavigation = (href: string) => {
    if (pathname !== href) {
        setIsLoading(true);
    }
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  const visibleNavItems = NAV_ITEMS.filter(item => !item.isAdmin || (item.isAdmin && isAdmin));

  return (
    <SidebarMenu>
      {visibleNavItems.map((item, index) => {
        const Icon = getIcon(item.icon);

        if (!Icon) return null;

        if (item.isInstallButton) {
            return (
              <SidebarMenuItem key={`${item.title}-${index}`}>
                <InstallPwaButton className="w-full justify-start h-8 text-sm group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:p-0">
                  <Icon className={cn("h-5 w-5", item.color)} />
                  <span className="group-data-[state=collapsed]:hidden">{item.title}</span>
                </InstallPwaButton>
              </SidebarMenuItem>
            );
        }

        const hasChildren = item.children && item.children.length > 0
        const isSubMenuCurrentlyOpen = !!openSubMenus[item.title]
        const isParentActive =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "#" &&
            pathname.startsWith(item.href))
        const isChildActive =
          hasChildren &&
          item.children!.some(
            (child) => pathname === child.href || pathname.startsWith(child.href)
          )
        const isActive = isParentActive || isChildActive;
        const isActualLink = item.href && item.href !== "#"

        return (
          <SidebarMenuItem key={`${item.title}-${index}`}>
            <SidebarMenuButton
             asChild={!!isActualLink}
              isActive={isActive}
              tooltip={{
                children: item.title,
                side: "right",
                className: "bg-popover text-popover-foreground",
              }}
              onClick={(e) => {
                if(item.href) handleNavigation(item.href);
                if (hasChildren && !isActualLink) {
                    e.preventDefault();
                    toggleSubMenu(item.title)
                }
              }}
            >
              {isActualLink ? (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2",
                    hasChildren && "justify-between w-full"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", item.color)} />
                    <span className="group-data-[state=collapsed]:hidden">
                      {item.title}
                    </span>
                  </div>
                  {hasChildren && (
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform group-data-[state=collapsed]:hidden",
                        isSubMenuCurrentlyOpen && "rotate-90"
                      )}
                    />
                  )}
                </Link>
              ) : hasChildren ? (
                <div className="flex items-center justify-between w-full text-left">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", item.color)} />
                    <span className="group-data-[state=collapsed]:hidden">
                      {item.title}
                    </span>
                  </div>
                  <ChevronRight
                    className={cn(
                      "ml-auto h-4 w-4 transition-transform group-data-[state=collapsed]:hidden",
                      isSubMenuCurrentlyOpen && "rotate-90"
                    )}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", item.color)} />
                  <span className="group-data-[state=collapsed]:hidden">
                    {item.title}
                  </span>
                </div>
              )}
            </SidebarMenuButton>

            {hasChildren && isSubMenuCurrentlyOpen && (
              <SidebarMenu className="pl-4 mt-1 space-y-1">
                {item.children!.map((child, childIndex) => {
                  if (child.isAdmin && (!userProfile || !userProfile.isAdmin)) {
                    return null
                  }
                  const isChildLinkActive =
                    pathname === child.href || pathname.startsWith(child.href)
                  const ChildIcon = getIcon(child.icon);
                  if (!ChildIcon) return null;

                  return (
                    <SidebarMenuItem key={`${child.title}-${childIndex}`}>
                      {child.children && child.children.length > 0 ? (
                        <>
                           <SidebarMenuButton
                            size="sm"
                            isActive={isChildLinkActive}
                            tooltip={{
                                children: child.title,
                                side: "right",
                                className: "bg-popover text-popover-foreground",
                            }}
                            className="h-8 justify-between w-full"
                            onClick={() => toggleSubMenu(child.title)}
                           >
                            <div className="flex items-center gap-2">
                                <ChildIcon className={cn("h-4 w-4", child.color)} />
                                <span className="group-data-[state=collapsed]:hidden">{child.title}</span>
                            </div>
                            <ChevronRight className={cn("h-4 w-4 transition-transform group-data-[state=collapsed]:hidden", openSubMenus[child.title] && "rotate-90")} />
                           </SidebarMenuButton>
                           {openSubMenus[child.title] && (
                            <SidebarMenu className="pl-4 mt-1 space-y-1">
                                {child.children.map((subChild, subChildIndex) => {
                                  const SubChildIcon = getIcon(subChild.icon);
                                  if(!SubChildIcon) return null;
                                  const isSubChildActive = pathname === subChild.href || pathname.startsWith(subChild.href);
                                  return (
                                    <SidebarMenuItem key={`${subChild.title}-${subChildIndex}`}>
                                        <SidebarMenuButton asChild size="sm" isActive={isSubChildActive} tooltip={{children: subChild.title, side: "right", className: "bg-popover text-popover-foreground"}} className="h-8" onClick={() => handleNavigation(subChild.href)}>
                                            <Link href={subChild.href}>
                                                <SubChildIcon className={cn("h-4 w-4", subChild.color)} />
                                                <span className="group-data-[state=collapsed]:hidden">{subChild.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )})}
                            </SidebarMenu>
                           )}
                        </>
                      ) : (
                        <SidebarMenuButton
                            asChild
                            size="sm"
                            isActive={isChildLinkActive}
                            tooltip={{
                                children: child.title,
                                side: "right",
                                className: "bg-popover text-popover-foreground",
                            }}
                            className="h-8"
                            onClick={() => handleNavigation(child.href)}
                        >
                            <Link href={child.href}>
                                <ChildIcon className={cn("h-4 w-4", child.color)} />
                            <span className="group-data-[state=collapsed]:hidden">
                                {child.title}
                            </span>
                            </Link>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            )}
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
