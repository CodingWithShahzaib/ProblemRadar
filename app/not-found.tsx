"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted/50 px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">
        404 · Page missing
      </div>
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Can’t find that page</h1>
        <p className="text-muted-foreground">
          The route you requested is unavailable. Use the dashboard or start a new analysis.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">New analysis</Link>
        </Button>
      </div>
    </div>
  );
}
