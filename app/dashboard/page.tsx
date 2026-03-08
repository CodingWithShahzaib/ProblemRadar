"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await fetch("/api/projects/list", { cache: "no-store" });
        const data = (await res.json()) as { projects: ProjectRow[] };
        if (isMounted) setProjects(data.projects ?? []);
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
  const totals = useMemo(
    () => ({
      projects: rows.length,
      posts: rows.reduce((sum, p) => sum + p.postCount, 0),
      problems: rows.reduce((sum, p) => sum + p.problemCount, 0),
    }),
    [rows]
  );

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

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Projects",
            value: isLoading ? "…" : totals.projects,
            hint: "Ready, running, or finished.",
            tint: "from-primary/10",
          },
          {
            label: "Posts aggregated",
            value: isLoading ? "…" : totals.posts,
            hint: "Reddit API / OpenAI web search.",
            tint: "from-blue-400/10",
          },
          {
            label: "Problems detected",
            value: isLoading ? "…" : totals.problems,
            hint: "AI extraction + clustering.",
            tint: "from-emerald-400/10",
          },
        ].map((item) => (
          <Card key={item.label} className="relative overflow-hidden">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.tint} via-transparent to-transparent`} />
            <CardHeader className="relative pb-2">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-semibold tabular-nums">{item.value}</div>
              <p className="text-sm text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Projects</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${rows.length} project(s)`}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              No projects yet. Create one from the home page.
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
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
                    {rows.map((p) => (
                      <TableRow
                        key={p.id}
                        className="even:bg-muted/20 hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="max-w-[420px] truncate font-medium">{p.url}</div>
                          {p.errorMessage ? (
                            <div className="max-w-[420px] break-words text-xs text-destructive line-clamp-2">
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
        </CardContent>
      </Card>
    </div>
  );
}

