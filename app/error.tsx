"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("App error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-destructive/10 px-4 py-2 text-xs uppercase tracking-widest text-destructive">
        Unexpected error
      </div>
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground">
          The request could not be completed. Retry the page or return home.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </div>
  );
}
