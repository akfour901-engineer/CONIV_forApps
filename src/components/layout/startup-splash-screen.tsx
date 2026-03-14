
'use client';

import React, { useState, useEffect } from 'react';
import Logo from "./logo";
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

interface StartupSplashScreenProps {
  message?: string;
}

export function StartupSplashScreen({ message = "Loading..." }: StartupSplashScreenProps) {
  const [stage, setStage] = useState<'spinning' | 'textVisible'>('spinning');
  
  const appName = APP_NAME;

  useEffect(() => {
    const textTimer = setTimeout(() => {
        setStage('textVisible');
    }, 2000); // Shorter delay before showing text

    return () => {
      clearTimeout(textTimer);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 fade-in">
      <div className="flex flex-col items-center justify-center">
        <Logo
          href="#"
          iconClassName={cn(
            "h-48 w-48 text-primary transition-all duration-500", // Increased size
            stage === 'spinning' && "animate-logo-vibrate" // Use new animation
          )}
          iconOnly={true}
        />
        <div className="mt-4 overflow-hidden h-12 flex items-center justify-center">
             <div 
                className={cn(
                    "text-4xl font-bold tracking-widest text-primary opacity-0",
                    stage === 'textVisible' && "text-pop-up-animation"
                )}
             >
                {appName}
            </div>
        </div>
         <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
}

export default StartupSplashScreen;
