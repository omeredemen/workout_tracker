import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { BottomNav, NavBar } from "@/components/nav/BottomNav";
import { RepositoryProvider } from "@/data/RepositoryProvider";
import { SyncProvider } from "@/data/sync/SyncProvider";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";
import { RestTimerBar } from "@/components/workout/RestTimerBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Import a training program, follow the calendar, log every set.",
  applicationName: "Workout Tracker",
  appleWebApp: {
    capable: true,
    title: "Workouts",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <RepositoryProvider>
          <SyncProvider>
            <ClientOnly>
              <OfflineBanner />
            </ClientOnly>
            {children}
            <ClientOnly>
              <RestTimerBar />
            </ClientOnly>
          </SyncProvider>
        </RepositoryProvider>
        <ServiceWorker />
        <Suspense fallback={<NavBar />}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
