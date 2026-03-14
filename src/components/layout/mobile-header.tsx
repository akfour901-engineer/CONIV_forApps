
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PanelLeft, LogOut, Briefcase, Home as HomeIcon } from 'lucide-react';
import Logo from '@/components/layout/logo';
import { SidebarNav } from '@/components/layout/sidebar/sidebar-nav';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { getFirebaseAuth } from '@/lib/firebase';
import { useLoading } from '@/contexts/loading-context';

export function MobileHeader() {
  const { toast } = useToast();
  const { setIsLoading } = useLoading();
  const {
    user,
    setActiveContextOwnerId,
    isUserActuallyATeamMember,
    isViewingOwnAccount,
    teamOwnerProfileFromInitialLoad
  } = useAuth();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const handleLogout = async () => {
    const auth = await getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
    toast({ title: 'Logged Out' });
    router.push('/auth/signin');
  };

  const handleSwitchContext = (targetOwnerId: string | null) => {
    if (!targetOwnerId) return;
    setIsLoading(true);
    setActiveContextOwnerId(targetOwnerId);
    setOpen(false); // Close the sheet after switching
    router.push('/dashboard'); // Navigate to a neutral page after switch
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="sm:hidden">
          <PanelLeft className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="sm:max-w-xs p-0 flex flex-col">
        <nav className="grid gap-6 text-lg font-medium p-4">
          <Logo href="/dashboard" onNavigate={() => setOpen(false)} />
          {isUserActuallyATeamMember && (
            <div className="space-y-2">
                <h4 className="font-semibold px-4 text-sm text-muted-foreground">Switch Context</h4>
                 <Button
                    onClick={() => handleSwitchContext(user!.uid)}
                    disabled={isViewingOwnAccount}
                    variant={isViewingOwnAccount ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                >
                    <HomeIcon className="mr-2 h-4 w-4" /> My Account
                </Button>
                <Button
                    onClick={() => handleSwitchContext(teamOwnerProfileFromInitialLoad!.uid)}
                    disabled={!isViewingOwnAccount}
                    variant={!isViewingOwnAccount ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                >
                    <Briefcase className="mr-2 h-4 w-4" /> {teamOwnerProfileFromInitialLoad?.fullName || 'Team'}
                </Button>
            </div>
          )}
          <Separator />
          <SidebarNav />
        </nav>
         <div className="mt-auto p-4 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
