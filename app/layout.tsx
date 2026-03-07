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
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <div className="min-h-dvh">
          <TopNav />
          <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
