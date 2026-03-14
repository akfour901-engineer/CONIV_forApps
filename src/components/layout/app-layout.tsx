
'use client';

import type { FC, ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
} from '@/components/ui/sidebar';

import { BottomNavBar } from './bottom-nav-bar';
import Logo from '../logo';
import { useAuth } from '@/hooks/use-auth';
import { SidebarNav } from '@/components/layout/sidebar/sidebar-nav';
import { getFirebaseAuth } from '@/lib/firebase';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: FC<AppLayoutProps> = ({ children }) => {
  const { setActiveContextOwnerId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const handleLogout = async () => {
    const auth = await getFirebaseAuth();
    try {
      if(auth) {
        await signOut(auth);
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out.",
        });
        setActiveContextOwnerId(null);
        window.location.href = "/auth/signin";
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r hidden md:block">
        <SidebarHeader className="p-4">
          <Logo />
        </SidebarHeader>
        <SidebarContent className="p-2 pr-0">
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-3 border-t">
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="group-data-[state=expanded]:hidden"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex max-h-screen flex-1 flex-col overflow-hidden">
        {children}
        <BottomNavBar />
      </SidebarInset>
      
    </>
  );
};

export default AppLayout;
