import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { LoadingProvider } from "@/contexts/loading-context";
import { PwaInstallProvider } from "@/contexts/pwa-install-context";
import { Toaster } from "@/components/ui/toaster";
import { APP_NAME } from "@/lib/constants";
import { AuthProvider } from "@/hooks/use-auth";
import { ClientLayout } from "@/components/layout/client-layout";
import { FirebaseProvider } from "@/firebase/provider";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import SplashHandler from "@/components/capacitor/SplashHandler"
import NetworkHandler from "@/components/capacitor/NetworkHandler"
import BackButtonHandler from "@/components/capacitor/BackButtonHandler"
import AppLifecycleHandler from "@/components/capacitor/AppLifecycleHandler"
import StatusBarHandler from "@/components/capacitor/StatusBarHandler"
import KeyboardHandler from "@/components/capacitor/KeyboardHandler"
import OrientationHandler from "@/components/capacitor/OrientationHandler"
import LocalNotificationHandler from "@/components/capacitor/LocalNotificationHandler"
import PullToRefresh from "@/components/capacitor/PullToRefresh"

// Register background jobs on the server side
if (typeof window === 'undefined') {
  import('@/jobs/weekly-digest-cron').then((m) => {
    m.registerWeeklyDigestCron();
  }).catch(console.error);
}

export const metadata: Metadata = {
  title: `${APP_NAME} | All-in-One Contracting Solution`,
  description: "Your all-in-one solution for managing construction and contracting projects.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#008080",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
            <head>
        <meta name="application-name" content={APP_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#008080" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M80 20 C 40 20 20 40 20 80 L 20 20 C 20 40 40 20 80 20 Z' fill='%23008080' opacity='0.2'/><path d='M75 25 C 45 25 25 45 25 75 C 25 45 45 25 75 25 Z' stroke='%23008080' stroke-width='10' fill='none' stroke-linecap='round' stroke-linejoin='round'/><rect x='40' y='40' width='30' height='8' rx='2' fill='%231E90FF' /><rect x='40' y='52' width='8' height='20' rx='2' fill='%231E90FF' /></svg>" />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          GeistSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
        <ServiceWorkerRegister />
        <SplashHandler />
        <NetworkHandler />
        <BackButtonHandler />
        <AppLifecycleHandler />
        <StatusBarHandler />
        <KeyboardHandler />
        <OrientationHandler />
        <LocalNotificationHandler />
        <PullToRefresh />

          <LoadingProvider>
            <PwaInstallProvider>
              <FirebaseProvider>
                <AuthProvider>
                  <ClientLayout>
                    {children}
                  </ClientLayout>
                </AuthProvider>
              </FirebaseProvider>
              <Toaster />
            </PwaInstallProvider>
          </LoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
