"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Check, Globe2, Rocket, ShieldCheck, Sparkles } from "lucide-react";

const USE_OPENAI = process.env.NEXT_PUBLIC_USE_OPENAI === "true";

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
  const searchSource: "REDDIT" | "OPENAI_WEB" = USE_OPENAI ? "OPENAI_WEB" : "REDDIT";

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
        body: JSON.stringify({ url: finalUrl, searchSource }),
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
    <div className="relative pb-14">
      <div className="grid gap-10">
        <section className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="relative overflow-hidden rounded-3xl border bg-card/70 p-8 shadow-xl backdrop-blur">
            <div className="pointer-events-none absolute -right-28 -top-28 size-[420px] rounded-full bg-primary/10 blur-3xl" />
            <svg
              className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 text-primary/25 dark:text-primary/20"
              viewBox="0 0 400 400"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="200" cy="200" r="170" stroke="currentColor" strokeWidth="2" opacity="0.35" />
              <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="2" opacity="0.28" />
              <circle cx="200" cy="200" r="70" stroke="currentColor" strokeWidth="2" opacity="0.22" />
              <path d="M30 200H370" stroke="currentColor" strokeWidth="2" opacity="0.2" />
              <path d="M200 30V370" stroke="currentColor" strokeWidth="2" opacity="0.2" />
              <path d="M95 95L305 305" stroke="currentColor" strokeWidth="2" opacity="0.14" />
              <path d="M305 95L95 305" stroke="currentColor" strokeWidth="2" opacity="0.14" />
              <path
                d="M200 200 L340 140"
                stroke="currentColor"
                strokeWidth="3"
                opacity="0.45"
                strokeLinecap="round"
              />
              <circle cx="340" cy="140" r="6" fill="currentColor" opacity="0.55" />
            </svg>

            <div className="relative grid gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">MVP · No auth</Badge>
                <Badge variant="outline">
                  Source: {searchSource === "REDDIT" ? "Reddit API" : "OpenAI web search"}
                </Badge>
              </div>

              <div className="grid gap-3">
                <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  Find real user pain. Fast.
                </h1>
                <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
                  ProblemRadar turns messy Reddit chatter into a clean list of problems and clusters—so
                  you can validate ideas, prioritize features, and reach out to leads.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Scrape & keyword signals",
                    copy: "Extract product terms from your site automatically.",
                    icon: <Globe2 className="h-4 w-4" />,
                  },
                  {
                    title: "Search at scale",
                    copy: "Reddit API / OpenAI web search with backoff + retries.",
                    icon: <ShieldCheck className="h-4 w-4" />,
                  },
                  {
                    title: "AI problem extraction",
                    copy: "Summaries + confidence, stored for review.",
                    icon: <Sparkles className="h-4 w-4" />,
                  },
                  {
                    title: "Cluster themes",
                    copy: "Embeddings + cosine grouping into buckets.",
                    icon: <Rocket className="h-4 w-4" />,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border bg-background/60 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                        {item.icon}
                      </div>
                      <div className="font-medium">{item.title}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{item.copy}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {[
                  "BullMQ queue + worker",
                  "SSE status updates",
                  "Rerun-friendly",
                  "CSV exports",
                ].map((x) => (
                  <span key={x} className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-3 py-1">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-6">
              <div className="grid gap-1">
                <CardTitle className="text-2xl">Analyze a website</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Start a run. Then watch it progress in real time.
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Rocket className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <form onSubmit={onSubmit} className="space-y-3">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://resumeai.com"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="h-11"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" disabled={isSubmitting} className="h-11">
                    {isSubmitting ? "Starting…" : "Run analysis"}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => router.push("/dashboard")}
                  >
                    View dashboard
                  </Button>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </form>

              <div className="grid gap-2 rounded-2xl border bg-muted/25 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Run mode</span>
                  <span className="font-medium">Async · background worker</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">
                    {searchSource === "REDDIT" ? "Reddit API" : "OpenAI web search"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Output</span>
                  <span className="font-medium">Problems · clusters · leads</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Scrape & extract",
              copy: "Cheerio + TF-like scoring on meta, headings, main text.",
              icon: <Globe2 className="h-5 w-5" />,
            },
            {
              title: "Search",
              copy: "Reddit API or OpenAI web search with retries/backoff.",
              icon: <ShieldCheck className="h-5 w-5" />,
            },
            {
              title: "AI problems",
              copy: "OpenAI summaries + embeddings, cosine clustering, named groups.",
              icon: <Sparkles className="h-5 w-5" />,
            },
            {
              title: "Operate",
              copy: "BullMQ queue, SSE status, reruns, CSV export, sortable tables.",
              icon: <Rocket className="h-5 w-5" />,
            },
          ].map((item) => (
            <Card key={item.title} className="h-full">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">{item.icon}</div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.copy}</CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

