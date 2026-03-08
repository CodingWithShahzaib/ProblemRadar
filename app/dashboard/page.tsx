"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLANS } from "@/lib/plan";

type ProjectRow = {
  id: string;
  url: string;
  createdAt: string;
  status: string;
  stage: string;
  errorMessage: string | null;
  keywordCount: number;
  postCount: number;
  problemCount: number;
  clusterCount: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    projectsCreated: number;
    runsStarted: number;
    postsFetched: number;
    problemsExtracted: number;
    periodEnd: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "done" | "error">("all");
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await fetch("/api/projects/list", { cache: "no-store" });
        if (res.status === 401) {
          throw new Error("Please sign in to view your dashboard.");
        }
        const data = (await res.json()) as {
          projects: ProjectRow[];
          plan?: { id?: string } | string;
          usage?: {
            projectsCreated: number;
            runsStarted: number;
            postsFetched: number;
            problemsExtracted: number;
            periodEnd: string;
          };
        };
        if (isMounted) setProjects(data.projects ?? []);
        if (isMounted) {
          const pid = typeof data.plan === "string" ? data.plan : data.plan?.id;
          setPlanId(pid ?? null);
          if (data.usage) setUsage(data.usage);
        }
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load projects.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    const t = setInterval(load, 4000);
    return () => {
      isMounted = false;
      clearInterval(t);
    };
  }, []);

  const rows = useMemo(() => projects, [projects]);
  const filteredRows = useMemo(() => {
    return rows.filter((p) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? p.status === "RUNNING" || p.status === "PENDING"
            : statusFilter === "done"
              ? p.status === "DONE"
              : p.status === "ERROR";
      const matchesSearch =
        !searchFilter.trim() ||
        p.url.toLowerCase().includes(searchFilter.trim().toLowerCase()) ||
        p.stage.toLowerCase().includes(searchFilter.trim().toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [rows, searchFilter, statusFilter]);
  const totals = useMemo(
    () => ({
      projects: rows.length,
      posts: rows.reduce((sum, p) => sum + p.postCount, 0),
      problems: rows.reduce((sum, p) => sum + p.problemCount, 0),
    }),
    [rows]
  );
  const health = useMemo(() => {
    const active = rows.filter((p) => p.status === "RUNNING" || p.status === "PENDING").length;
    const errors = rows.filter((p) => p.status === "ERROR").length;
    const avgProblems = rows.length === 0 ? 0 : Math.round(totals.problems / rows.length);
    return { active, errors, avgProblems };
  }, [rows, totals.problems]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold leading-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor pipeline progress and jump into the projects that need attention.
          </p>
        </div>
        <Button onClick={() => router.push("/")}>New project</Button>
      </div>

        {planId ? (
          <div className="rounded-xl border bg-muted/20 p-3 text-sm">
            Plan: <span className="font-medium uppercase">{planId}</span>{" "}
            <Button variant="link" className="px-1" onClick={() => router.push("/pricing")}>
              Upgrade
            </Button>
          </div>
        ) : null}

        {usage && planId ? (
          <div className="grid gap-2 rounded-xl border bg-muted/10 p-4">
            <p className="text-sm font-medium">Usage this period (resets {new Date(usage.periodEnd).toLocaleDateString()})</p>
            {[
              { label: "Projects", used: usage.projectsCreated, limit: PLANS[planId as keyof typeof PLANS]?.limits.maxProjects ?? PLANS.free.limits.maxProjects },
              { label: "Runs", used: usage.runsStarted, limit: PLANS[planId as keyof typeof PLANS]?.limits.maxRunsPerDay ?? PLANS.free.limits.maxRunsPerDay, hint: "per day" },
              { label: "Posts", used: usage.postsFetched, limit: PLANS[planId as keyof typeof PLANS]?.limits.maxPosts ?? PLANS.free.limits.maxPosts },
              { label: "Problems", used: usage.problemsExtracted, limit: PLANS[planId as keyof typeof PLANS]?.limits.maxProblems ?? PLANS.free.limits.maxProblems },
            ].map((row) => {
              const pct = Math.min(100, Math.round((row.used / row.limit) * 100));
              const isNearLimit = pct >= 80;
              return (
                <div key={row.label} className="grid gap-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{row.label}{row.hint ? ` (${row.hint})` : ""}</span>
                    <span className={`tabular-nums ${isNearLimit ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      {row.used} / {row.limit}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${isNearLimit ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                      title={pct >= 100 ? "Limit reached" : `${pct}% of limit`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}{" "}
          <Button variant="link" className="px-1" onClick={() => signIn(undefined, { callbackUrl: "/dashboard" })}>
            Sign in
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Projects",
            value: isLoading ? null : totals.projects,
            hint: "Ready, running, or finished.",
            tint: "from-primary/10",
          },
          {
            label: "Posts aggregated",
            value: isLoading ? null : totals.posts,
            hint: "Reddit API / OpenAI web search.",
            tint: "from-blue-400/10",
          },
          {
            label: "Problems detected",
            value: isLoading ? null : totals.problems,
            hint: "AI extraction + clustering.",
            tint: "from-emerald-400/10",
          },
        ].map((item) => (
          <Card key={item.label} className="relative overflow-hidden">
            <div className={`pointer-events-none absolute inset-0 bg-linear-to-br ${item.tint} via-transparent to-transparent`} />
            <CardHeader className="relative pb-2">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
            </CardHeader>
            <CardContent className="relative">
              {item.value === null ? (
                <div className="h-8 w-16 rounded-md bg-muted/60 animate-pulse" />
              ) : (
                <div className="text-3xl font-semibold tabular-nums">{item.value}</div>
              )}
              <p className="text-sm text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active runs", value: health.active, hint: "Running or pending", tone: "from-primary/10" },
          { label: "Errors to triage", value: health.errors, hint: "Rerun with one click", tone: "from-destructive/10" },
          { label: "Avg problems/project", value: health.avgProblems, hint: "Signals density", tone: "from-amber-400/10" },
        ].map((item) => (
          <Card key={item.label} className="relative overflow-hidden">
            <div className={`pointer-events-none absolute inset-0 bg-linear-to-br ${item.tone} via-transparent to-transparent`} />
            <CardHeader className="relative pb-2">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-semibold tabular-nums">{item.value}</div>
              <p className="text-sm text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-1">
            <CardTitle>Projects</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${filteredRows.length} of ${rows.length} project(s)`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              Auto-refreshing every 4s
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "done", label: "Done" },
                { id: "error", label: "Errors" },
              ].map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={statusFilter === f.id ? "secondary" : "ghost"}
                  className="rounded-full"
                  onClick={() => setStatusFilter(f.id as typeof statusFilter)}
                  aria-pressed={statusFilter === f.id}
                >
                  {f.label}
                </Button>
              ))}
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search URL or stage"
                className="h-9 w-56"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              {rows.length === 0 ? "No projects yet. Create one from the home page." : "No projects match this filter."}
            </div>
          ) : null}

          {filteredRows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow className="bg-muted/30">
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Keywords</TableHead>
                      <TableHead className="text-right">Posts</TableHead>
                      <TableHead className="text-right">Problems</TableHead>
                      <TableHead className="text-right">Clusters</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((p) => (
                      <TableRow
                        key={p.id}
                        className="even:bg-muted/20 hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="max-w-[420px] truncate font-medium">{p.url}</div>
                          {p.errorMessage ? (
                            <div className="max-w-[420px] wrap-break-word text-xs text-destructive line-clamp-2">
                              {p.errorMessage}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant={
                                p.status === "DONE"
                                  ? "default"
                                  : p.status === "ERROR"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {p.status}
                            </Badge>
                            <Badge variant="outline">{p.stage}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.keywordCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.postCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.problemCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.clusterCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/project/${p.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              <div className="h-4 w-24 rounded bg-muted/60 animate-pulse" />
              <div className="grid gap-2">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="h-10 rounded bg-muted/40 animate-pulse" />
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

