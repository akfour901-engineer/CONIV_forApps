
'use client';

import Link from 'next/link';
import type { FC } from 'react';
import { APP_NAME } from '@/lib/constants';
import { cn } from "@/lib/utils";
import { useSidebar } from '@/components/ui/sidebar';
import * as React from 'react';


// New Coniv App Icon SVG
export const ConivAppIcon: FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "h-8 w-8"}>
    <path d="M80 20 C 40 20 20 40 20 80 L 20 20 C 20 40 40 20 80 20 Z" fill="hsl(var(--primary))" opacity="0.2"/>
    <path d="M75 25 C 45 25 25 45 25 75 C 25 45 45 25 75 25 Z" 
          stroke="hsl(var(--primary))" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Stylized 'C' or abstract construction elements */}
    <rect x="40" y="40" width="30" height="8" rx="2" fill="hsl(var(--accent))" /> {/* Top bar of a 'C' or a beam */}
    <rect x="40" y="52" width="8" height="20" rx="2" fill="hsl(var(--accent))" /> {/* Vertical bar of a 'C' or a pillar */}
  </svg>
);

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  href?: string;
  textClassName?: string;
  iconClassName?: string;
  onNavigate?: () => void;
}

const useSafeSidebar = () => {
  try {
    return useSidebar();
  } catch (e) {
    // This component might be used outside a SidebarProvider (e.g., public pages).
    // Provide a default state to prevent crashing.
    return { state: 'expanded' };
  }
};

const AppLogo: FC<LogoProps> = ({
  className,
  iconOnly = false,
  href = "/dashboard", 
  textClassName = "text-sidebar-foreground", 
  iconClassName = "h-8 w-8",
  onNavigate
}) => {
  const { state } = useSafeSidebar();
  const isCollapsed = state === 'collapsed';
  const appName = APP_NAME;

  const showText = !iconOnly && !isCollapsed;

  return (
    <Link href={href} className={cn("flex items-center gap-2", className, isCollapsed ? 'justify-center' : 'justify-start')} onClick={onNavigate}>
      <ConivAppIcon className={cn("transition-all ease-in-out", iconClassName, isCollapsed ? 'h-6 w-6' : 'h-8 w-8')} />
      {showText && (
        <span 
          className={cn(
            "text-xl font-semibold uppercase tracking-widest",
            textClassName 
          )}
        >
        
        </span>
      )}
    </Link>
  );
};

export default AppLogo;
