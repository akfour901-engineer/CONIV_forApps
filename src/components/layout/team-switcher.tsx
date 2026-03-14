
'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Briefcase, Home as HomeIcon, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/contexts/loading-context';

interface TeamSwitcherProps {
  isCollapsed: boolean;
}

export function TeamSwitcher({ isCollapsed }: TeamSwitcherProps) {
  const { 
    user,
    setActiveContextOwnerId, 
    isUserActuallyATeamMember,
    isViewingOwnAccount,
    teamOwnerProfileFromInitialLoad,
    activeContextOwnerId,
    currentTeamOwnerProfile
  } = useAuth();
  const router = useRouter();
  const { setIsLoading } = useLoading();

  if (!isUserActuallyATeamMember) {
    return null;
  }

  const handleSwitchContext = (newOwnerId: string | null) => {
    setIsLoading(true);
    setActiveContextOwnerId(newOwnerId);
    // Refresh the page to ensure all data is re-fetched for the new context
    router.push('/dashboard');
  };

  const ownerName = teamOwnerProfileFromInitialLoad?.fullName || teamOwnerProfileFromInitialLoad?.email || 'Your Team';

  if (isCollapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Briefcase className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right">
          <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleSwitchContext(user!.uid)} disabled={isViewingOwnAccount}>
             <HomeIcon className="mr-2 h-4 w-4" />
            My Account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSwitchContext(teamOwnerProfileFromInitialLoad!.uid)} disabled={!isViewingOwnAccount}>
             <Briefcase className="mr-2 h-4 w-4" />
            {ownerName}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2 truncate">
            {isViewingOwnAccount ? <HomeIcon className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
            <span className="truncate">{isViewingOwnAccount ? "My Account" : ownerName}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
         <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleSwitchContext(user!.uid)} disabled={isViewingOwnAccount}>
             <HomeIcon className="mr-2 h-4 w-4" />
            My Account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSwitchContext(teamOwnerProfileFromInitialLoad!.uid)} disabled={!isViewingOwnAccount}>
             <Briefcase className="mr-2 h-4 w-4" />
            {ownerName}
          </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
