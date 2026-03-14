
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Coins } from "lucide-react"
import Link from "next/link"
import { useLoading } from "@/contexts/loading-context";

interface InsufficientPointsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  requiredPoints?: number
  currentPoints?: number
}

export function InsufficientPointsDialog({
  isOpen,
  onOpenChange,
  requiredPoints,
  currentPoints,
}: InsufficientPointsDialogProps) {
  const { setIsLoading } = useLoading();
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center">
            <Coins className="mr-2 h-5 w-5 text-amber-500" />
            Insufficient Resource Points
          </AlertDialogTitle>
          <AlertDialogDescription>
            You do not have enough points to perform this action.
            <div className="mt-2 text-sm text-foreground">
              <p>Required points: <span className="font-bold text-destructive">{requiredPoints ?? '...'}</span></p>
              <p>Your balance: <span className="font-bold">{currentPoints ?? '...'}</span></p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild onClick={() => setIsLoading(true)}>
            <Link href="/dashboard/coins-payments/buy-coins">
              Buy More Points
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
