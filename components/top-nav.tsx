"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function TopNav() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", theme);
    }
  }, [theme]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur supports-backdrop-filter:bg-background/55">
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-primary/90 via-primary to-blue-400/80 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <span className="text-sm font-semibold">PR</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">ProblemRadar</span>
            <span className="text-[11px] text-muted-foreground">Find real user pain</span>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border bg-background/70 p-1 shadow-sm sm:flex">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost", size: "sm", className: "rounded-full" })}
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className={buttonVariants({ variant: "default", size: "sm", className: "rounded-full" })}
            >
              New project
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              New project
            </Link>
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </nav>
      </div>
    </header>
  );
}

