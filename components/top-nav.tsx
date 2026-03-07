"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function TopNav() {
  return (
    <header className="border-b bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">PR</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">
            ProblemRadar
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

