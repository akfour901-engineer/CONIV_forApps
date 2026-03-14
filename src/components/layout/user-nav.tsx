
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { getFirebaseAuth } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { signOut } from "firebase/auth"
import {
  Briefcase,
  Coins,
  Home as HomeIcon,
  Info,
  LogOut,
  Settings,
  User,
} from "lucide-react"

export function UserNav() {
  const {
    user,
    userProfile,
    loading: authLoading,
    activeContextOwnerId,
    setActiveContextOwnerId,
    currentTeamOwnerProfile,
    isUserActuallyATeamMember,
    isViewingOwnAccount,
    teamOwnerProfileFromInitialLoad,
    updateGlobalUserProfile,
    teamMemberPermissionsFromInitialLoad
  } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
      const auth = await getFirebaseAuth()
      if (auth) {
        await signOut(auth);
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out.",
        });
        setActiveContextOwnerId(null);
        window.location.href = "/auth/signin";
      }
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "Logout Failed",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (authLoading || !user || !userProfile) {
    return (
      <Button asChild variant="ghost">
        <Link href="/auth/signin">Sign In</Link>
      </Button>
    )
  }

  const getInitials = (name: string | undefined | null) => {
    if (!name) return "U"
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U"
    )
  }

  const designatedTeamOwnerForDisplay =
    teamOwnerProfileFromInitialLoad?.fullName ||
    teamOwnerProfileFromInitialLoad?.email ||
    (teamOwnerProfileFromInitialLoad?.uid
      ? `Team (${teamOwnerProfileFromInitialLoad.uid.substring(0, 6)})`
      : "Team")

  const currentContextDisplayName = isViewingOwnAccount
    ? "My Account"
    : currentTeamOwnerProfile?.fullName ||
      currentTeamOwnerProfile?.email ||
      `Team Account`

  const handleSwitchContext = (targetOwnerId: string | null) => {
    if (!targetOwnerId || targetOwnerId === activeContextOwnerId) return

    setActiveContextOwnerId(targetOwnerId)

    if (window.location.pathname !== "/dashboard") {
      router.push("/dashboard");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={userProfile.profilePicture || undefined}
              alt={userProfile.fullName || "User"}
              data-ai-hint="person avatar"
            />
            <AvatarFallback>{getInitials(userProfile.fullName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userProfile.fullName || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            {isViewingOwnAccount && userProfile.resourcePoints !== undefined && (
              <div className="flex items-center pt-1 text-xs text-muted-foreground">
                <Coins className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                My Points: {userProfile.resourcePoints}
              </div>
            )}
            {!isViewingOwnAccount &&
              currentTeamOwnerProfile?.resourcePoints !== undefined && (
                <div className="flex items-center pt-1 text-xs text-muted-foreground">
                  <Coins className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                  Team Points: {currentTeamOwnerProfile.resourcePoints}
                </div>
              )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center px-2 py-1.5 text-xs text-muted-foreground">
            <Info className="mr-1.5 h-3.5 w-3.5" />
            Managing:
            <span
              className="ml-1 truncate font-semibold text-primary"
              title={currentContextDisplayName}
            >
              {currentContextDisplayName}
            </span>
          </DropdownMenuLabel>
          {isUserActuallyATeamMember && (
            <>
              {!isViewingOwnAccount && user?.uid && (
                <DropdownMenuItem onClick={() => handleSwitchContext(user.uid)}>
                  <HomeIcon className="mr-2 h-4 w-4" />
                  <span>Manage My Account</span>
                </DropdownMenuItem>
              )}
              {isViewingOwnAccount && teamOwnerProfileFromInitialLoad?.uid && (
                <DropdownMenuItem
                  onClick={() =>
                    handleSwitchContext(teamOwnerProfileFromInitialLoad.uid)
                  }
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  <span>
                    Manage Team: {designatedTeamOwnerForDisplay}
                  </span>
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile" >
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings" >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
