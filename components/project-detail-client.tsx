"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Key, Layers, MessageCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ApiCluster = {
  id: string;
  clusterName: string;
  problemCount: number;
};

type ApiPost = {
  id: string;
  title: string;
  content: string;
  author: string;
  subreddit: string;
  source: string;
  upvotes: number;
  comments: number;
  postUrl: string;
  redditCreatedAt: string | null;
  matchedKeyword: string | null;
  problem:
    | null
    | {
        id: string;
        problemText: string;
        confidenceScore: number;
        severityScore: number;
        trendScore: number;
        evidenceCount: number;
        contactHint: string | null;
        cluster: null | { id: string; clusterName: string };
      };
};

type ApiProject = {
  id: string;
  url: string;
  createdAt: string;
  status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  stage: string;
  errorMessage: string | null;
  keywords: string[];
  keywordCount: number;
  postCount: number;
  problemCount: number;
  clusterCount: number;
  sources?: string[];
};

type ApiRun = {
  id: string;
  status: string;
  stage: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiLog = {
  id: string;
  stage: string;
  message: string;
  createdAt: string;
};

type ProjectDetailResponse = {
  project: ApiProject;
  clusters: ApiCluster[];
  runs: ApiRun[];
  posts: ApiPost[];
  logs: ApiLog[];
  runDiff?: { runId: string; deltaProblems: number; deltaPosts: number } | null;
};

function formatPct(x: number) {
  return `${Math.round(x * 100)}%`;
}

function ClusterBarChart({ clusters }: { clusters: ApiCluster[] }) {
  const data = clusters.slice(0, 8);
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No clusters yet.</p>;
  }
  const max = Math.max(...data.map((c) => c.problemCount), 1);
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">Top problem clusters</p>
      <div className="grid gap-2">
        {data.map((c) => {
          const pct = Math.round((c.problemCount / max) * 100);
          return (
            <div key={c.id} className="grid gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{c.clusterName}</span>
                <span className="tabular-nums text-muted-foreground">{c.problemCount}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function formatTimeLabel(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString();
}

function formatDateOnlyLabel(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function shortId(id: string) {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function titleCase(input: string) {
  return input
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function siteNameFromUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;

    const parts = host.split(".").filter(Boolean);
    if (parts.length <= 1) return titleCase(parts[0] ?? host);

    const last2 = parts.slice(-2).join(".");
    const commonTwoPartTlds = new Set([
      "co.uk",
      "org.uk",
      "ac.uk",
      "gov.uk",
      "com.au",
      "net.au",
      "org.au",
      "co.nz",
    ]);

    const candidate = commonTwoPartTlds.has(last2)
      ? parts[parts.length - 3]
      : parts[parts.length - 2];

    return candidate ? titleCase(candidate) : titleCase(parts[0] ?? host);
  } catch {
    return null;
  }
}

function isAbortError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  return (err as { name?: unknown }).name === "AbortError";
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("leads");
  const [isRerunBusy, setIsRerunBusy] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [postSort, setPostSort] = useState<{
    field: "upvotes" | "comments" | "date";
    dir: "desc" | "asc";
  }>({ field: "upvotes", dir: "desc" });
  const [outreachDraft, setOutreachDraft] = useState("");
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [isOutreachLoading, setIsOutreachLoading] = useState(false);
  const [isWebhookExporting, setIsWebhookExporting] = useState(false);
  const [postFilter, setPostFilter] = useState<"all" | "problematic">("all");
  const [problemFilter, setProblemFilter] = useState<string | "all">("all");

  useEffect(() => {
    let isMounted = true;
    const url = `/api/projects/${projectId}?postSortBy=${postSort.field}&postSortDir=${postSort.dir}`;
    let lastProject: ApiProject | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let snapshotInFlight = false;
    let aborter: AbortController | null = null;

    async function loadSnapshot() {
      if (snapshotInFlight) return;
      snapshotInFlight = true;
      aborter?.abort();
      aborter = new AbortController();
      try {
        const res = await fetch(url, { cache: "no-store", signal: aborter.signal });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as ProjectDetailResponse;
        if (!isMounted) return;
        setError(null);
        lastProject = json.project;
        setData(json);
      } catch (e) {
        if (!isMounted) return;
        if (isAbortError(e)) return;
        setError(e instanceof Error ? e.message : "Failed to load project.");
      } finally {
        snapshotInFlight = false;
      }
    }

    function scheduleSnapshotRefresh() {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        loadSnapshot().catch(() => {
          // Keep SSE status updates; snapshot refresh is best-effort.
        });
      }, 250);
    }

    void loadSnapshot();

    const es = new EventSource(`/api/projects/${projectId}/events`);
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { project: ApiProject; runs: ApiRun[] };
        const prev = lastProject;
        const next = payload.project;
        const changed =
          !prev ||
          prev.keywordCount !== next.keywordCount ||
          prev.postCount !== next.postCount ||
          prev.problemCount !== next.problemCount ||
          prev.clusterCount !== next.clusterCount ||
          prev.stage !== next.stage ||
          prev.status !== next.status;

        lastProject = next;
        if (changed) scheduleSnapshotRefresh();

        setData((prev) =>
          prev
            ? { ...prev, project: payload.project, runs: payload.runs }
            : { project: payload.project, runs: payload.runs, clusters: [], logs: [], posts: [] }
        );

        if (payload.project.status === "DONE" || payload.project.status === "ERROR") {
          es.close();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };
    es.onerror = () => {
      // Let EventSource auto-reconnect on transient failures.
    };

    return () => {
      isMounted = false;
      aborter?.abort();
      if (refreshTimer) clearTimeout(refreshTimer);
      es.close();
    };
  }, [projectId, postSort.field, postSort.dir]);

  const project = data?.project ?? null;
  const clusters = data?.clusters ?? [];
  const posts = useMemo(() => data?.posts ?? [], [data]);
  const logs = data?.logs ?? [];
  const sortedPosts = useMemo(() => {
    const arr = [...posts];
    arr.sort((a, b) => {
      if (postSort.field === "date") {
        const da = a.redditCreatedAt ? new Date(a.redditCreatedAt).getTime() : 0;
        const db = b.redditCreatedAt ? new Date(b.redditCreatedAt).getTime() : 0;
        return postSort.dir === "desc" ? db - da : da - db;
      }
      if (postSort.field === "comments") {
        return postSort.dir === "desc" ? b.comments - a.comments : a.comments - b.comments;
      }
      return postSort.dir === "desc" ? b.upvotes - a.upvotes : a.upvotes - b.upvotes;
    });
    return arr;
  }, [posts, postSort]);
  const filteredPosts = useMemo(
    () => (postFilter === "problematic" ? sortedPosts.filter((p) => p.problem) : sortedPosts),
    [postFilter, sortedPosts]
  );
  const runs = data?.runs ?? [];

  const keywords = project?.keywords ?? [];
  const runDiff = data?.runDiff ?? null;

  const problems = useMemo(
    () => posts.filter((p) => p.problem).map((p) => p.problem!),
    [posts]
  );
  const filteredProblems = useMemo(
    () =>
      problemFilter === "all"
        ? problems
        : problems.filter((p) => p.cluster?.id === problemFilter),
    [problemFilter, problems]
  );

  const leads = useMemo(
    () =>
      posts
        .filter((p) => p.problem)
        .map((p) => ({
          username: p.author,
          subreddit: p.subreddit,
          problem: p.problem!.problemText,
          postUrl: p.postUrl,
        })),
    [posts]
  );

  const suggestedStartStage = useMemo(() => {
    if (!project) return "REDDIT_FETCH" as const;
    if (project.postCount === 0 && project.keywordCount > 0) return "REDDIT_FETCH" as const;
    if (project.problemCount === 0 && project.postCount > 0) return "AI_EXTRACT" as const;
    if (project.clusterCount === 0 && project.problemCount > 0) return "CLUSTER" as const;
    return "SCRAPE" as const;
  }, [project]);

  async function rerun(params: { resetData: boolean; startStage?: string }) {
    setIsRerunBusy(true);
    setRerunError(null);
    try {
      const res = await fetch("/api/projects/rerun", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          resetData: params.resetData,
          startStage: params.startStage,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setRerunError(e instanceof Error ? e.message : "Failed to rerun.");
    } finally {
      setIsRerunBusy(false);
    }
  }

  async function schedule(cron: "daily" | "weekly") {
    setIsScheduling(true);
    setScheduleMessage(null);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, cron }),
      });
      if (!res.ok) throw new Error(await res.text());
      setScheduleMessage(`Scheduled ${cron} reruns.`);
    } catch (e) {
      setScheduleMessage(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setIsScheduling(false);
    }
  }

  async function exportToWebhook() {
    const webhookUrl = window.prompt("Webhook URL to send leads to");
    if (!webhookUrl) return;
    setIsWebhookExporting(true);
    try {
      const res = await fetch("/api/export/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, webhookUrl }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      alert("Leads sent to webhook");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsWebhookExporting(false);
    }
  }

  const siteName = useMemo(() => siteNameFromUrl(project?.url), [project?.url]);

  async function generateOutreach() {
    if (isOutreachLoading) return;
    setIsOutreachLoading(true);
    setOutreachError(null);
    try {
      const lead = leads[0];
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: lead?.username ?? "there",
          problem: lead?.problem ?? "the pains you mentioned",
          product: siteName ?? "ProblemRadar",
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to draft outreach");
      setOutreachDraft(json.message ?? "");
    } catch (e) {
      setOutreachError(e instanceof Error ? e.message : "Failed to draft outreach");
    } finally {
      setIsOutreachLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="sticky top-16 z-20 rounded-2xl border bg-background/85 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Project</p>
            <p className="truncate font-semibold">{project ? project.url : "Loading…"}</p>
          </div>
          {project ? (
            <>
              <Badge
                variant={
                  project.status === "DONE"
                    ? "default"
                    : project.status === "ERROR"
                      ? "destructive"
                      : "secondary"
                }
              >
                {project.status}
              </Badge>
              <Badge variant="outline">Stage: {project.stage}</Badge>
              <Badge variant="outline">Created: {formatDateLabel(project.createdAt)}</Badge>
              {project.sources && project.sources.length > 0 ? (
                <Badge variant="outline">Sources: {project.sources.join(", ")}</Badge>
              ) : null}
            </>
          ) : null}
          <div className="flex-1" />
          <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Back
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/api/export?projectId=${encodeURIComponent(projectId)}`;
            }}
          >
            Export CSV
          </Button>
          <Button variant="outline" size="sm" disabled={isWebhookExporting} onClick={exportToWebhook}>
            {isWebhookExporting ? "Exporting…" : "Webhook"}
          </Button>
          <Button variant="outline" size="sm" disabled={isScheduling} onClick={() => schedule("daily")}>
            {isScheduling ? "Scheduling…" : "Daily"}
          </Button>
          {project ? (
            <Dialog>
              <DialogTrigger render={<Button size="sm" />}>Rerun</DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Rerun analysis</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 text-sm">
                  <p className="text-muted-foreground">
                    If this run failed due to missing env vars or rate limits, retry without wiping data—or restart from scratch.
                  </p>
                  {rerunError ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                      {rerunError}
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    <Button
                      disabled={isRerunBusy || project.status === "RUNNING"}
                      onClick={() => rerun({ resetData: false, startStage: suggestedStartStage })}
                    >
                      Retry from {suggestedStartStage}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isRerunBusy || project.status === "RUNNING"}
                      onClick={() => rerun({ resetData: true, startStage: "SCRAPE" })}
                    >
                      Rerun from scratch (wipe posts/problems/clusters)
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: if you fixed env vars, hit retry. If keywords look wrong, use from scratch.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        {scheduleMessage ? (
          <div className="mt-2 text-xs text-muted-foreground">{scheduleMessage}</div>
        ) : null}
        {error ? (
          <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive" role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <Card className="relative overflow-hidden px-4 shadow-lg sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project ? (siteName ?? "Project") : "Loading project…"}
            </h1>
            <p className="text-muted-foreground">
              {project ? project.url : "Preparing snapshot"}
            </p>
            {!project ? (
              <div className="flex gap-2">
                <div className="h-6 w-28 rounded-md bg-muted/60 animate-pulse" />
                <div className="h-6 w-24 rounded-md bg-muted/60 animate-pulse" />
              </div>
            ) : null}
          </div>
        </div>

        {project?.errorMessage ? (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive">
            {project.errorMessage}
          </div>
        ) : null}

        <div className="relative mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            {
              label: "Keywords",
              value: project ? project.keywordCount : null,
              hint: "Extracted signals",
              icon: <Key className="h-4 w-4" />,
            },
            {
              label: "Posts",
              value: project ? project.postCount : null,
              hint: "Reddit or OpenAI search",
              icon: <MessageCircle className="h-4 w-4" />,
            },
            {
              label: "Problems",
              value: project ? project.problemCount : null,
              hint: "AI-detected pain points",
              icon: <Sparkles className="h-4 w-4" />,
            },
            {
              label: "Clusters",
              value: project ? project.clusterCount : null,
              hint: "Grouped themes",
              icon: <Layers className="h-4 w-4" />,
            },
          ].map((item) => (
            <Card key={item.label} className="relative overflow-hidden border bg-card/60">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent" />
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    {item.label}
                  </CardTitle>
                  <div className="text-primary/80">{item.icon}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {item.value === null ? (
                  <div className="h-7 w-12 rounded bg-muted/60 animate-pulse" />
                ) : (
                  <div className="text-2xl font-semibold tabular-nums">{item.value}</div>
                )}
                <div className="text-sm text-muted-foreground">{item.hint}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full flex-wrap justify-start rounded-2xl border bg-background/60 p-1">
          <TabsTrigger className="rounded-xl px-3" value="leads">
            Leads ({leads.length})
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-3" value="problems">
            Problems ({problems.length})
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-3" value="keywords">
            Keywords ({keywords.length})
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-3" value="posts">
            Posts ({posts.length})
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-3" value="clusters">
            Clusters ({clusters.length})
          </TabsTrigger>
          <TabsTrigger className="rounded-xl px-3" value="operations">
            Ops & logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead discovery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-2">
                <div className="text-sm font-medium">Outreach draft</div>
                <Textarea
                  value={outreachDraft}
                  onChange={(e) => setOutreachDraft(e.target.value)}
                  placeholder="Draft a quick outreach message here…"
                  className="min-h-24"
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={generateOutreach} disabled={isOutreachLoading}>
                    {isOutreachLoading ? "Generating…" : "AI draft"}
                  </Button>
                  {outreachError ? <span className="text-xs text-destructive">{outreachError}</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: export CSV and enrich leads in your CRM.
                </p>
              </div>
              {leads.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No leads yet. This will populate as problems are extracted.
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto rounded-2xl border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/30">
                        <TableHead>Username</TableHead>
                        <TableHead>Subreddit</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead className="text-right">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((l, idx) => (
                        <TableRow key={`${l.postUrl}-${idx}`} className="hover:bg-muted/20">
                          <TableCell className="font-medium">
                            {l.username}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">r/{l.subreddit}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[520px] truncate">
                            {l.problem}
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                              })}
                              href={l.postUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Extracted keywords</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {keywords.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Keywords will appear after the website is scraped.
                </div>
              ) : (
                keywords.map((k) => (
                  <Badge key={k} variant="secondary">
                    {k}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Reddit posts</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Show:</span>
                  <Button
                    variant={postFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPostFilter("all")}
                  >
                    All posts
                  </Button>
                  <Button
                    variant={postFilter === "problematic" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPostFilter("problematic")}
                  >
                    With problems
                  </Button>
                  <span className="text-muted-foreground">Sort:</span>
                  {(
                    [
                      { key: "upvotes", label: "Upvotes" },
                      { key: "comments", label: "Comments" },
                      { key: "date", label: "Date" },
                    ] as const
                  ).map((opt) => (
                    <Button
                      key={opt.key}
                      variant={postSort.field === opt.key ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setPostSort((prev) => ({
                          field: opt.key,
                          dir:
                            prev.field === opt.key && prev.dir === "desc" ? "asc" : "desc",
                        }))
                      }
                    >
                      {opt.label} {postSort.field === opt.key ? `(${postSort.dir})` : ""}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredPosts.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {postFilter === "problematic"
                    ? "No posts with extracted problems yet. Switch to All to see raw posts."
                    : "Posts will appear after Reddit search completes."}
                </div>
              ) : (
                <div className="max-h-[640px] overflow-auto rounded-2xl border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/30">
                        <TableHead>Title</TableHead>
                        <TableHead>Subreddit</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead className="text-right">Upvotes</TableHead>
                        <TableHead className="text-right">Comments</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPosts.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/20">
                          <TableCell className="max-w-[520px] truncate font-medium">
                            {p.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">r/{p.subreddit}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.source}</Badge>
                          </TableCell>
                          <TableCell>{p.author}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.upvotes}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.comments}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatDateOnlyLabel(p.redditCreatedAt)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {p.matchedKeyword ? (
                              <Badge variant="outline">{p.matchedKeyword}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger
                                render={<Button variant="outline" size="sm" />}
                              >
                                View
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="text-balance">
                                    {p.title}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-3 text-sm">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                      r/{p.subreddit}
                                    </Badge>
                                    <Badge variant="outline">{p.author}</Badge>
                                    <Badge variant="outline">
                                      {p.upvotes} upvotes
                                    </Badge>
                                    <Badge variant="outline">
                                      {p.comments} comments
                                    </Badge>
                                    {p.problem ? (
                                      <Badge>Problem detected</Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        No problem yet
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="max-h-[45vh] overflow-auto rounded-lg border bg-muted/30 p-3 whitespace-pre-wrap">
                                    {p.content || "(No text content)"}
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <a
                                      className={buttonVariants({
                                        variant: "default",
                                      })}
                                      href={p.postUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Open on Reddit
                                    </a>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="problems" className="mt-4">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Detected problems</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Filter:</span>
                <Button
                  variant={problemFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProblemFilter("all")}
                >
                  All clusters
                </Button>
                <select
                  className="rounded-lg border bg-background px-2 py-1 text-xs"
                  value={problemFilter}
                  onChange={(e) => setProblemFilter(e.target.value as string)}
                >
                  <option value="all">All</option>
                  {clusters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.clusterName}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredProblems.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {problems.length === 0
                    ? "Problems will appear after AI extraction completes."
                    : "No problems match this cluster filter."}
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto rounded-2xl border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/30">
                        <TableHead>Problem</TableHead>
                        <TableHead>Cluster</TableHead>
                        <TableHead className="text-right">Severity</TableHead>
                        <TableHead className="text-right">Contact</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProblems.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/20">
                          <TableCell className="font-medium">
                            {p.problemText}
                          </TableCell>
                          <TableCell>
                            {p.cluster ? (
                              <Badge variant="secondary">
                                {p.cluster.clusterName}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <Badge variant="secondary">
                              {formatPct(p.severityScore ?? 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {p.contactHint ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <Badge variant="outline">
                              {formatPct(p.confidenceScore)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Clusters</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {clusters.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Clusters will appear after embeddings clustering completes.
                  </div>
                ) : (
                  clusters
                    .slice()
                    .sort((a, b) => b.problemCount - a.problemCount)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border bg-background/60 p-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {c.clusterName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.problemCount} problem(s)
                          </div>
                        </div>
                        <Badge variant="secondary" className="tabular-nums">
                          {c.problemCount}
                        </Badge>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top problems chart</CardTitle>
              </CardHeader>
              <CardContent>
                <ClusterBarChart
                  clusters={clusters
                    .slice()
                    .sort((a, b) => b.problemCount - a.problemCount)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="mt-4">
          <div className="grid gap-4">
            {runDiff ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Latest run delta</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Run {shortId(runDiff.runId)} added {runDiff.deltaProblems} problem(s) across {runDiff.deltaPosts} post(s).
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recent runs</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  {runs.length === 0 ? (
                    <div className="text-muted-foreground">No runs recorded yet.</div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[170px]">Run ID</TableHead>
                            <TableHead className="w-[96px]">Status</TableHead>
                            <TableHead className="w-[140px]">Stage</TableHead>
                            <TableHead className="hidden sm:table-cell w-[190px]">
                              Started
                            </TableHead>
                            <TableHead className="hidden md:table-cell w-[190px]">
                              Updated
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runs.map((r) => (
                            <TableRow key={r.id} className="hover:bg-muted/20">
                              <TableCell className="text-xs text-muted-foreground">
                                <span className="block truncate font-mono" title={r.id}>
                                  {shortId(r.id)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    r.status === "DONE"
                                      ? "default"
                                      : r.status === "ERROR"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                >
                                  {r.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{r.stage}</Badge>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs tabular-nums text-muted-foreground">
                                <span className="block truncate">
                                  {formatDateLabel(r.createdAt)}
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs tabular-nums text-muted-foreground">
                                <span className="block truncate">
                                  {formatDateLabel(r.updatedAt)}
                                </span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-destructive">
                                <span className="block truncate">
                                  {r.errorMessage ?? "—"}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Run logs</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-xs">
                  {logs.length === 0 ? (
                    <div className="text-muted-foreground">No logs yet.</div>
                  ) : (
                    <div className="max-h-[280px] overflow-auto rounded-2xl border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Stage</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead className="text-right">At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => (
                            <TableRow key={log.id} className="hover:bg-muted/20">
                              <TableCell>
                                <Badge variant="outline">{log.stage}</Badge>
                              </TableCell>
                              <TableCell className="max-w-[480px] truncate">{log.message}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatTimeLabel(log.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

