"use client"

import * as React from "react"
import { APP_NAME } from "@/lib/constants"
import { useLoading } from "@/contexts/loading-context"
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react"
import Link from "next/link"
import type { SocialLinks } from '@/types';
import { useEffect, useState } from 'react';

const XIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className || "h-5 w-5"}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zM17.5 19.5h1.5l-6.52-8.625L7 3.5H5.5l7.155 9.485L17.5 19.5z" />
  </svg>
)

export function PublicFooter() {
  const { setIsLoading } = useLoading();
  const [socialLinks, setSocialLinks] = React.useState<SocialLinks | null>(null);
  const [appName, setAppName] = React.useState(APP_NAME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    
    const fetchContent = async () => {
        try {
            const response = await fetch('/api/public-config');
            if(!response.ok) throw new Error("Failed to fetch public config");
            const config = await response.json();
            setSocialLinks(config.socialLinks || null);
            setAppName(config.appName || APP_NAME);
        } catch (error) {
            console.warn("Could not fetch public config for footer, using default.");
        }
    };
    fetchContent();
  }, [mounted]);

  if (!mounted) {
    return (
      <footer className="border-t bg-background py-8 text-center">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 sm:flex-row md:px-6">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t bg-background py-8 text-center">
      <div className="container mx-auto flex flex-col items-center justify-between px-4 sm:flex-row md:px-6">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {appName}. All rights reserved.
        </p>
        <div className="mt-4 flex items-center space-x-4 sm:mt-0">
          <Link
            href="/legal/terms-and-conditions"
            className="text-xs text-muted-foreground hover:text-primary"
            onClick={() => setIsLoading(true)}
          >
            Terms & Conditions
          </Link>
          <Link
            href="/legal/privacy-policy"
            className="text-xs text-muted-foreground hover:text-primary"
            onClick={() => setIsLoading(true)}
          >
            Privacy Policy
          </Link>
          {socialLinks?.youtube && (
            <a
              href={socialLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              aria-label="YouTube"
              title="YouTube"
            >
              <Youtube className="h-5 w-5" />
            </a>
          )}
          {socialLinks?.linkedin && (
            <a
              href={socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </a>
          )}
          {socialLinks?.instagram && (
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              aria-label="Instagram"
              title="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
          )}
          {socialLinks?.facebook && (
            <a
              href={socialLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              aria-label="Facebook"
              title="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}