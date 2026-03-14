"use client"

import { Button } from "@/components/ui/button"
import { AppWindow } from 'lucide-react'
import * as React from 'react';
import { useToast } from "@/hooks/use-toast";
import { InstallPwaButton } from "../ui/install-pwa-button";
import { useEffect, useState } from 'react';

export function AppDownloadSection() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <section className="w-full py-12 md:py-20 lg:py-28 bg-secondary/20">
                <div className="container px-4 md:px-6 text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary">Get Our App on Any Device</h2>
                    <p className="mt-4 text-lg text-muted-foreground">Install our app directly from your browser for a seamless experience on your desktop or mobile device.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="w-full py-12 md:py-20 lg:py-28 bg-secondary/20">
            <div className="container px-4 md:px-6 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary">Get Our App on Any Device</h2>
                <p className="mt-4 text-lg text-muted-foreground">Install our app directly from your browser for a seamless experience on your desktop or mobile device.</p>
                <div className="mt-8 flex items-center justify-center gap-4">
                    <InstallPwaButton />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">If the button is disabled, please try reloading the page. If it remains disabled, you can manually install the app using the `Add to Home Screen` or `Install App` option in your browser`s menu.</p>
            </div>
        </section>
    )
}