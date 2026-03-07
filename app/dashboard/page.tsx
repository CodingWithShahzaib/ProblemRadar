"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Projects you’ve analyzed will show up here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${rows.length} project(s)`}
            </p>
            <Link href="/" className={buttonVariants({ variant: "default" })}>
              New project
            </Link>
          </div>

          {rows.length === 0 && !isLoading ? (
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
              No projects yet. Create one from the home page.
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[420px] truncate">
                        <span className="font-medium">{p.url}</span>
                        {p.errorMessage ? (
                          <div className="mt-1 text-xs text-destructive">
                            {p.errorMessage}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
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
                        <Link
                          href={`/project/${p.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

