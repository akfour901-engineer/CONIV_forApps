
"use client"

import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import type { AppConfiguration, TemporaryBanner } from "@/types"
import { isAfter, parseISO } from "date-fns"
import { arrayUnion, doc, updateDoc } from "firebase/firestore"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Gift,
  Megaphone,
  ShieldCheck,
  X,
} from "lucide-react"
import Link from "next/link"

import { Skeleton } from "../ui/skeleton"

export function TemporaryBanner() {
  const {
    user,
    userProfile,
    loading: authLoading,
    updateGlobalUserProfile,
    isPasswordChangeRequired,
    isPinChangeRequired,
    isPinVerified,
    appConfig
  } = useAuth()
  const [activeBanners, setActiveBanners] = React.useState<TemporaryBanner[]>(
    []
  )
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isVisible, setIsVisible] = React.useState(false)
  const { toast } = useToast()

  React.useEffect(() => {
    if (authLoading || !user || !userProfile || !appConfig) {
      if (!authLoading) setIsLoading(false)
      return
    }

    if (
      isPasswordChangeRequired ||
      (isPinChangeRequired && isPinVerified)
    ) {
      setIsLoading(false)
      setActiveBanners([])
      setIsVisible(false)
      return
    }
    
    setIsLoading(true);
    const now = new Date()
    const dismissedBanners: string[] = JSON.parse(
      localStorage.getItem("dismissed_banners") || "[]"
    )
    const userClaimedRewards = userProfile.claimedBannerRewards || []

    const validBanners = (appConfig.temporaryBanners || []).filter(
      (banner) =>
        banner.enabled &&
        (!banner.validUntil || isAfter(parseISO(banner.validUntil), now)) &&
        !dismissedBanners.includes(banner.id) &&
        (!banner.isRewardBanner || !userClaimedRewards.includes(banner.id))
    )

    setActiveBanners(validBanners)
    if (validBanners.length > 0) {
      setIsVisible(true)
      setCurrentIndex(0)
    } else {
      setIsVisible(false)
    }
    setIsLoading(false);
    
  }, [
    user,
    userProfile,
    authLoading,
    isPasswordChangeRequired,
    isPinChangeRequired,
    isPinVerified,
    appConfig,
  ])

  const handleDismiss = () => {
    if (activeBanners.length > 0) {
      const bannerToDismiss = activeBanners[currentIndex]
      const dismissedBanners: string[] = JSON.parse(
        localStorage.getItem("dismissed_banners") || "[]"
      )
      if (!dismissedBanners.includes(bannerToDismiss.id)) {
        dismissedBanners.push(bannerToDismiss.id)
        localStorage.setItem("dismissed_banners", JSON.stringify(dismissedBanners))
      }

      const remainingBanners = activeBanners.filter(
        (b) => b.id !== bannerToDismiss.id
      )
      setActiveBanners(remainingBanners)

      if (remainingBanners.length === 0) {
        setIsVisible(false)
      } else {
        setCurrentIndex((prev) => (prev >= remainingBanners.length ? 0 : prev))
      }
    }
  }

  const handleClaimReward = async () => {
    if (!user || !userProfile || activeBanners.length === 0) return
    const banner = activeBanners[currentIndex]
    if (!banner.isRewardBanner || !banner.rewardPoints) return

    const userDocRef = doc(db, "users", user.uid)
    try {
      const newPoints = (userProfile.resourcePoints || 0) + banner.rewardPoints
      await updateDoc(userDocRef, {
        claimedBannerRewards: arrayUnion(banner.id),
        resourcePoints: newPoints,
      })
      
      const idToken = await user.getIdToken();
      await fetch('/api/user-actions/log-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
        body: JSON.stringify({
            actionType: 'banner_reward_claimed',
            entityType: 'UserProfile',
            entityId: user.uid,
            entityName: banner.title,
            details: {
              message: `Claimed reward from banner: "${banner.title}"`,
              pointsAdded: banner.rewardPoints,
              bannerId: banner.id,
            }
        })
      });


      // Update global state
      if (updateGlobalUserProfile) {
        const updatedProfile = {
          ...userProfile,
          claimedBannerRewards: [
            ...(userProfile.claimedBannerRewards || []),
            banner.id,
          ],
          resourcePoints: newPoints,
        }
        updateGlobalUserProfile(
          {
            userProfile: updatedProfile,
            teamOwnerProfileData: null,
            teamMemberPermissions: null,
          },
          user
        )
      }

      toast({
        title: "Reward Claimed!",
        description: `You've received ${banner.rewardPoints} points!`,
      })

      handleDismiss() // Dismiss after claiming
    } catch (error) {
      console.error("Error claiming banner reward:", error)
      toast({
        title: "Error",
        description: "Could not claim reward. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length)
  }
  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + activeBanners.length) % activeBanners.length
    )
  }

  if (
    isPasswordChangeRequired ||
    (isPinChangeRequired && isPinVerified)
  ) {
    return (
      <div className="mx-4 my-2 sm:mx-6 sm:my-4">
        <Alert
          variant="destructive"
          className="relative flex items-center gap-2 rounded-lg p-3 shadow-md"
        >
          <ShieldCheck className="h-6 w-6 shrink-0 text-destructive" />
          <div className="flex-grow">
            <AlertTitle className="font-bold">
              Security Update Required
            </AlertTitle>
            <AlertDescription className="text-sm">
              {isPasswordChangeRequired
                ? "Your password has expired and must be changed."
                : "Your App PIN has expired and must be changed."}
            </AlertDescription>
          </div>
        </Alert>
      </div>
    )
  }

  if (authLoading || isLoading) {
    return (
      <div className="mx-4 my-2 sm:mx-6 sm:my-4">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  if (!isVisible || activeBanners.length === 0) {
    return null
  }

  const currentBanner = activeBanners[currentIndex]

  return (
    <div className="mx-4 my-2 sm:mx-6 sm:my-4">
      <Alert className="relative flex items-center gap-2 rounded-lg border-primary/50 bg-primary/10 p-3 text-primary-foreground shadow-md">
        <Megaphone className="h-6 w-6 shrink-0 text-primary" />
        <div className="flex-grow">
          <AlertTitle className="font-bold text-primary">
            {currentBanner.title}
          </AlertTitle>
          <AlertDescription className="text-sm text-primary/90">
            {currentBanner.message}
            {currentBanner.link && (
              <Button
                asChild
                variant="link"
                className="h-auto p-0 pl-1.5 font-semibold text-primary-foreground hover:text-primary-foreground/80"
              >
                <Link href={currentBanner.link} target="_blank" rel="noopener noreferrer">
                  Learn more
                </Link>
              </Button>
            )}
          </AlertDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentBanner.isRewardBanner && (
            <Button
              size="sm"
              onClick={handleClaimReward}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              <Gift className="mr-2 h-4 w-4" /> Claim{" "}
              {currentBanner.rewardPoints} Points
            </Button>
          )}
          {activeBanners.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:bg-primary/20"
                onClick={handlePrev}
                key="prev"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-xs text-primary/80">
                {currentIndex + 1} / {activeBanners.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:bg-primary/20"
                onClick={handleNext}
                key="next"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-6 w-6 text-primary hover:bg-primary/20 hover:text-primary-foreground"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss banner</span>
          </Button>
        </div>
      </Alert>
    </div>
  )
}
