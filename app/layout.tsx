import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

import { TopNav } from "@/components/top-nav";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "ProblemRadar",
    template: "%s · ProblemRadar",
  },
  description:
    "Discover real problems people discuss on Reddit related to a product or website.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body
        suppressHydrationWarning
        className="min-h-dvh bg-background text-foreground antialiased"
      >
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-b from-background via-background to-background" />
          <div className="absolute -top-28 left-1/2 h-[420px] w-[980px] -translate-x-1/2 rounded-full bg-linear-to-r from-primary/20 via-blue-400/10 to-fuchsia-400/20 blur-3xl dark:from-primary/10 dark:via-blue-400/5 dark:to-fuchsia-400/10" />
          <div className="absolute -bottom-44 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-linear-to-r from-emerald-400/10 via-transparent to-primary/10 blur-3xl dark:from-emerald-400/5 dark:to-primary/10" />
          <div className="absolute inset-0 pr-bg-grid" />
        </div>

        <div className="min-h-dvh">
          <TopNav />
          <main className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
