"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
};

type ProjectDetailResponse = {
  project: ApiProject;
  clusters: ApiCluster[];
  posts: ApiPost[];
};

function formatPct(x: number) {
  return `${Math.round(x * 100)}%`;
}

function ClusterBarChart({ clusters }: { clusters: ApiCluster[] }) {
  const top = clusters.slice(0, 8);
  const max = Math.max(1, ...top.map((c) => c.problemCount));
  return (
    <div className="grid gap-3">
      <div className="text-sm font-medium">Top problem clusters</div>
      <div className="grid gap-2">
        {top.map((c) => {
          const w = Math.round((c.problemCount / max) * 100);
          return (
            <div key={c.id} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{c.clusterName}</span>
                <span className="tabular-nums text-muted-foreground">
                  {c.problemCount}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${w}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("leads");
  const [isRerunBusy, setIsRerunBusy] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timer: number | null = null;

    async function load() {
      try {
        setError(null);
        const res = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as ProjectDetailResponse;
        if (!isMounted) return;
        setData(json);

        const shouldPoll =
          json.project.status === "PENDING" || json.project.status === "RUNNING";
        if (shouldPoll) {
          timer = window.setTimeout(load, 2000);
        }
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : "Failed to load project.");
        timer = window.setTimeout(load, 4000);
      }
    }

    void load();
    return () => {
      isMounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [projectId]);

  const project = data?.project ?? null;
  const clusters = data?.clusters ?? [];
  const posts = data?.posts ?? [];

  const keywords = project?.keywords ?? [];

  const problems = useMemo(
    () => posts.filter((p) => p.problem).map((p) => p.problem!),
    [posts]
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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Project</h1>
          {project ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="max-w-[520px] truncate">
                {project.url}
              </Badge>
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
              <Badge variant="outline">{project.stage}</Badge>
              {project.errorMessage ? (
                <Badge variant="destructive" className="max-w-[520px] truncate">
                  {project.errorMessage}
                </Badge>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to dashboard
          </Link>
          {project ? (
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                Rerun
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Rerun analysis</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 text-sm">
                  <p className="text-muted-foreground">
                    If this run failed due to missing env vars or rate limits, you can retry without
                    wiping existing data, or restart from scratch.
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
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = `/api/export?projectId=${encodeURIComponent(
                projectId
              )}`;
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Load error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Keywords</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {project?.keywordCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {project?.postCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Problems</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {project?.problemCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clusters</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {project?.clusterCount ?? 0}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="keywords">Keywords ({keywords.length})</TabsTrigger>
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
          <TabsTrigger value="problems">Problems ({problems.length})</TabsTrigger>
          <TabsTrigger value="clusters">Clusters ({clusters.length})</TabsTrigger>
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
                  placeholder="Draft a quick outreach message here…"
                  className="min-h-24"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: export CSV and enrich leads in your CRM.
                </p>
              </div>
              {leads.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No leads yet. This will populate as problems are extracted.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Subreddit</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead className="text-right">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((l, idx) => (
                        <TableRow key={`${l.postUrl}-${idx}`}>
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
              <CardTitle>Reddit posts</CardTitle>
            </CardHeader>
            <CardContent>
              {posts.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Posts will appear after Reddit search completes.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Subreddit</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead className="text-right">Upvotes</TableHead>
                        <TableHead className="text-right">Comments</TableHead>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="max-w-[520px] truncate font-medium">
                            {p.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">r/{p.subreddit}</Badge>
                          </TableCell>
                          <TableCell>{p.author}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.upvotes}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.comments}
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
            <CardHeader>
              <CardTitle>Detected problems</CardTitle>
            </CardHeader>
            <CardContent>
              {problems.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Problems will appear after AI extraction completes.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Problem</TableHead>
                        <TableHead>Cluster</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {problems.map((p) => (
                        <TableRow key={p.id}>
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
                        className="flex items-center justify-between gap-2 rounded-lg border p-3"
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
      </Tabs>
    </div>
  );
}

