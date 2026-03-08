"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Check,
  Download,
  Globe2,
  Layers,
  Lock,
  MessageSquare,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

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
  const [sources, setSources] = useState<string[]>(USE_OPENAI ? ["REDDIT", "OPENAI_WEB"] : ["REDDIT"]);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const searchSource: "REDDIT" | "OPENAI_WEB" = USE_OPENAI ? "OPENAI_WEB" : "REDDIT";

  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  const workflow = [
    { title: "Crawl + extract", copy: "Meta, headings, keywords from your site to seed signals.", icon: <Globe2 className="h-4 w-4" /> },
    { title: "Search streams", copy: "Reddit API or OpenAI web with retries/backoff + chunking.", icon: <Server className="h-4 w-4" /> },
    { title: "AI problem detection", copy: "Summaries, scores, embeddings, and clustering into themes.", icon: <Sparkles className="h-4 w-4" /> },
    { title: "Leads + outreach", copy: "Matched posts with contact hints, CSV/webhook export ready.", icon: <MessageSquare className="h-4 w-4" /> },
  ];

  const reliability = [
    { title: "BullMQ worker", copy: "Queue + background worker, resumable without data loss.", icon: <Layers className="h-4 w-4" /> },
    { title: "Live status", copy: "SSE progress, retries, rate-limit handling baked in.", icon: <Activity className="h-4 w-4" /> },
    { title: "Data exits", copy: "CSV exports, webhook hooks, and dashboards ready to embed.", icon: <Download className="h-4 w-4" /> },
    { title: "Safe by default", copy: "Environment-keyed secrets, ready for auth, no PII storage by default.", icon: <Lock className="h-4 w-4" /> },
  ];

  const outputs = [
    { title: "Problem clusters", copy: "Top themes with counts, confidence, and severity scoring.", icon: <BarChart3 className="h-4 w-4" /> },
    { title: "Post evidence", copy: "Source posts with matched keywords and outbound links.", icon: <MessageSquare className="h-4 w-4" /> },
    { title: "Playbooks", copy: "Outreach drafts, CSVs, and webhooks to plug into CRM.", icon: <Workflow className="h-4 w-4" /> },
  ];

  const quickSignals = [
    { label: "Median run", value: "2m 40s", hint: "Queue + fetch + cluster" },
    { label: "Failure rate", value: "<1.5%", hint: "Auto-retries on throttling" },
    { label: "Exports", value: "CSV · webhook", hint: "Ready for ops" },
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (sources.length === 0) {
      setError("Pick at least one source.");
      return;
    }

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
        body: JSON.stringify({ url: finalUrl, searchSource, sources }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Please sign in to start analyses.");
          return;
        }
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

  async function createSampleProject() {
    setIsLoadingSample(true);
    setError(null);
    try {
      const res = await fetch("/api/sample", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create sample");
      }
      const data = (await res.json()) as { projectId: string };
      router.push(`/project/${data.projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create sample");
    } finally {
      setIsLoadingSample(false);
    }
  }

  return (
    <div className="relative pb-16">
      <div className="grid gap-12">
        <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="relative overflow-hidden rounded-3xl border bg-card/70 p-8 shadow-xl backdrop-blur">
            <div className="pointer-events-none absolute -right-24 -top-28 size-[420px] rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 size-72 rounded-full bg-blue-400/10 blur-3xl" />

            <div className="relative grid gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Built for founders</Badge>
                <Badge variant="outline">Source: {searchSource === "REDDIT" ? "Reddit API" : "OpenAI web search"}</Badge>
                <Badge variant="outline">BullMQ + SSE</Badge>
              </div>

              <div className="grid gap-3">
                <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  A technical radar for real user pain.
                </h1>
                <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
                  Drop a URL, we crawl it, search the web, and return prioritized problem clusters with evidence, ready for outreach—no dashboards to babysit.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: "Search coverage", copy: "Reddit API or OpenAI web with retries/backoff.", icon: <ShieldCheck className="h-4 w-4" /> },
                  { title: "AI extraction", copy: "Embeddings, clustering, severity + confidence scoring.", icon: <Sparkles className="h-4 w-4" /> },
                  { title: "Ops friendly", copy: "BullMQ worker, SSE progress, reruns without data loss.", icon: <Rocket className="h-4 w-4" /> },
                  { title: "Exports", copy: "CSV + webhook pipes for CRM or Slack.", icon: <Download className="h-4 w-4" /> },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">{item.icon}</div>
                      <div className="font-medium">{item.title}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{item.copy}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {["Retry-safe", "Background worker", "CSV + webhook export", "Auth-ready"].map((x) => (
                  <span key={x} className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-3 py-1">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    {x}
                  </span>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {quickSignals.map((signal) => (
                  <div key={signal.label} className="rounded-2xl border bg-background/70 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{signal.label}</p>
                    <p className="text-xl font-semibold">{signal.value}</p>
                    <p className="text-xs text-muted-foreground">{signal.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-xl">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent" />
            <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-6">
              <div className="grid gap-1">
                <CardTitle className="text-2xl">Analyze a website</CardTitle>
                <p className="text-sm text-muted-foreground">Start a run. Watch the queue, status, and output in real time.</p>
              </div>
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Rocket className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="url" className="text-sm font-medium">Website URL</Label>
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://resumeai.com"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    aria-invalid={Boolean(error)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">We add https:// automatically. Use a live marketing page for best signal extraction.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" disabled={isSubmitting} className="h-11">
                    {isSubmitting ? "Starting…" : "Run analysis"}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => router.push("/dashboard")}>
                    View dashboard
                  </Button>
                  <Button type="button" variant="secondary" className="h-11" disabled={isLoadingSample} onClick={createSampleProject}>
                    {isLoadingSample ? "Loading sample…" : "Load sample"}
                  </Button>
                </div>
                <div className="grid gap-3 rounded-2xl border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</div>
                    <Badge variant="outline" className="text-[11px]">Beta mix</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "REDDIT", label: "Reddit" },
                      { id: "OPENAI_WEB", label: "OpenAI web" },
                      { id: "HACKER_NEWS", label: "Hacker News" },
                      { id: "PRODUCT_HUNT", label: "Product Hunt" },
                      { id: "G2", label: "G2/App Store" },
                      { id: "X", label: "X / Twitter" },
                    ].map((s) => {
                      const checked = sources.includes(s.id);
                      return (
                        <Button
                          key={s.id}
                          type="button"
                          size="sm"
                          variant={checked ? "secondary" : "ghost"}
                          className="rounded-full"
                          onClick={() =>
                            setSources((prev) => (checked ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                          }
                          aria-pressed={checked}
                        >
                          {s.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Pick at least one source. Higher plans unlock all sources and more runs per day.</p>
                </div>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </form>

              <div className="grid gap-2 rounded-2xl border bg-muted/25 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Run mode</span>
                  <span className="font-medium">Async · background worker</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">{searchSource === "REDDIT" ? "Reddit API" : "OpenAI web search"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Output</span>
                  <span className="font-medium">Problems · clusters · leads</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 rounded-3xl border bg-card/70 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Product storyline</p>
              <p className="text-sm text-muted-foreground">From crawl to outreach in one predictable run.</p>
            </div>
            <Badge variant="secondary">No babysitting</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((step) => (
              <div key={step.title} className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">{step.icon}</div>
                  <div className="font-medium">{step.title}</div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="grid gap-1">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Operational guardrails</p>
                <p className="text-sm text-muted-foreground">Built to survive throttling, reruns, and exports.</p>
              </div>
              <Badge variant="secondary">Production-ready</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {reliability.map((item) => (
                <div key={item.title} className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">{item.icon}</div>
                    <div className="font-medium">{item.title}</div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <div className="grid gap-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Outputs</p>
                  <p className="text-sm text-muted-foreground">What you get per run.</p>
                </div>
                <Badge variant="outline">CSV + webhook</Badge>
              </div>
              <div className="grid gap-3">
                {outputs.map((item) => (
                  <div key={item.title} className="rounded-2xl border bg-background/70 p-3">
                    <div className="flex items-center gap-2">
                      <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">{item.icon}</div>
                      <p className="font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

