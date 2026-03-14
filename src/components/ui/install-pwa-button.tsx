'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AppWindow, Share } from 'lucide-react';
import { usePwaInstall } from '@/contexts/pwa-install-context';
import { useToast } from '@/hooks/use-toast';

interface InstallPwaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function InstallPwaButton({ asChild = false, children, ...props }: InstallPwaButtonProps) {
    const { deferredPrompt } = usePwaInstall();
    const { toast } = useToast();

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // This satisfies the requirement to call .prompt() after preventDefault()
            deferredPrompt.prompt();
                        // The userChoice property returns a Promise that resolves to an object with an outcome property.
                        await deferredPrompt.userChoice;
                        // The prompt can't be used again, but the beforeinstallprompt event may be fired again by the browser after some time.
                        // We don't nullify it here, as the context handles its state based on browser events.
            
            
            // The prompt can only be used once
          
        } else {
            // Fallback for browsers that don't support the prompt (like Safari) 
            // or if criteria are not yet met.
            toast({
                title: "Manual Installation Required",
                description: "To install, use the 'Add to Home Screen' or 'Install App' option in your browser's menu.",
                duration: 8000,  
              action: <div className="p-1"><Share className="h-5 w-5" /></div>
            });
        }
    };

 

    return (
        <Button onClick={handleInstallClick} {...props}>
            {children || <><AppWindow className="mr-2 h-5 w-5" /> Install App</>}
        </Button>
    );
}