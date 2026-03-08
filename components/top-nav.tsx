"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Moon, Sun, User } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function TopNav() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/pricing", label: "Pricing" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/docs", label: "Docs" },
    { href: "/changelog", label: "Changelog" },
  ];

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

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
    <header className="sticky top-0 z-30 border-b bg-background/80 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="ProblemRadar home">
          <div className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-primary/90 via-primary to-blue-400/80 text-primary-foreground shadow-sm ring-1 ring-primary/25">
            <span className="text-sm font-semibold">PR</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">ProblemRadar</span>
            <span className="text-[11px] text-muted-foreground">Find real user pain</span>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border bg-background/80 p-1 shadow-sm sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={buttonVariants({
                  variant: isActive(link.href) ? "secondary" : "ghost",
                  size: "sm",
                  className: "rounded-full data-[active=true]:shadow-sm",
                })}
                data-active={isActive(link.href)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/"
              aria-current={isActive("/") ? "page" : undefined}
              className={buttonVariants({ variant: "default", size: "sm", className: "rounded-full" })}
            >
              New project
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={buttonVariants({
                  variant: isActive(link.href) ? "secondary" : "ghost",
                  size: "sm",
                })}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/"
              aria-current={isActive("/") ? "page" : undefined}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              New project
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {status === "loading" ? (
              <Button variant="ghost" size="icon" aria-label="Loading session" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : session?.user ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline-flex">
                  {session.user.email ?? session.user.name ?? "Signed in"}
                </span>
                <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                  <User className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => signIn(undefined, { callbackUrl: "/dashboard" })}>
                <User className="mr-2 h-4 w-4" />
                Sign in
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label={`Toggle ${theme === "dark" ? "light" : "dark"} theme`}
            title="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            data-state={theme}
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}

