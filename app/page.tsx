"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const finalUrl = normalizedUrl;
    if (!finalUrl) {
      setError("Please enter a website URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: finalUrl }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { projectId: string };
      router.push(`/project/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-10">
      <section className="grid gap-4">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Find the real problems your customers talk about on Reddit.
        </h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Enter a website URL. ProblemRadar will extract keywords, search Reddit,
          detect pain points with AI, cluster them, and generate exportable
          leads.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Analyze a website</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3">
            <div className="grid gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://resumeai.com"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Starting…" : "Run analysis"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                View dashboard
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

