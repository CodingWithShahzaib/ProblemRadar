import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireOrgContext } from "@/lib/billing";

function parseKeywords(json: string | null) {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x)).filter(Boolean).slice(0, 20);
  } catch {
    return [];
  }
}

function parseSources(json: string | null) {
  if (!json) return ["REDDIT"];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return ["REDDIT"];
    return arr.map((x) => String(x)).filter(Boolean);
  } catch {
    return ["REDDIT"];
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId: userOrgId } = await requireOrgContext(session.user.id);

  const { id } = await params;
  const url = new URL(req.url);
  const postLimit = Math.min(200, Math.max(1, Number(url.searchParams.get("postLimit")) || 50));
  const postOffset = Math.max(0, Number(url.searchParams.get("postOffset")) || 0);
  const postSortBy = url.searchParams.get("postSortBy") ?? "upvotes";
  const postSortDir = url.searchParams.get("postSortDir") === "asc" ? "asc" : "desc";
  const problemLimit = Math.min(200, Math.max(1, Number(url.searchParams.get("problemLimit")) || 100));
  const problemOffset = Math.max(0, Number(url.searchParams.get("problemOffset")) || 0);

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      url: true,
      createdAt: true,
      orgId: true,
      status: true,
      stage: true,
      errorMessage: true,
      keywordsJson: true,
      keywordCount: true,
      postCount: true,
      problemCount: true,
      clusterCount: true,
      sourcesJson: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.orgId && project.orgId !== userOrgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [clusters, runs, posts, problems, logs] = await Promise.all([
    prisma.cluster.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        clusterName: true,
        _count: { select: { problems: true } },
      },
    }),
    prisma.projectRun.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        stage: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.post.findMany({
      where: { projectId: id },
      orderBy:
        postSortBy === "comments"
          ? { comments: postSortDir }
          : postSortBy === "date"
            ? { redditCreatedAt: postSortDir }
            : { upvotes: postSortDir },
      take: postLimit,
      skip: postOffset,
      include: {
        problem: { include: { cluster: true } },
      },
    }),
    prisma.problem.findMany({
      where: { post: { projectId: id } },
      orderBy: { confidenceScore: "desc" },
      take: problemLimit,
      skip: problemOffset,
      include: { cluster: true, post: { select: { subreddit: true, author: true, postUrl: true } } },
    }),
    prisma.projectRunLog.findMany({
      where: { run: { projectId: id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        runId: true,
        stage: true,
        message: true,
        createdAt: true,
      },
    }),
  ]);

  const sortedRuns = runs.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = sortedRuns[0];
  const prev = sortedRuns[1];
  const runDiff = latest && prev
    ? {
        runId: latest.id,
        deltaProblems: project.problemCount - (prev ? project.problemCount : 0),
        deltaPosts: project.postCount,
      }
    : null;

  return NextResponse.json({
    project: {
      ...project,
      keywords: parseKeywords(project.keywordsJson),
      sources: parseSources(project.sourcesJson),
    },
    runs,
    clusters: clusters.map(
      (c: { id: string; clusterName: string; _count: { problems: number } }) => ({
        id: c.id,
        clusterName: c.clusterName,
        problemCount: c._count.problems,
      })
    ),
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      author: p.author,
      subreddit: p.subreddit,
      source: p.source,
      upvotes: p.upvotes,
      comments: p.comments,
      postUrl: p.postUrl,
      redditCreatedAt: p.redditCreatedAt?.toISOString() ?? null,
      matchedKeyword: p.matchedKeyword,
      problem: p.problem
        ? {
            id: p.problem.id,
            problemText: p.problem.problemText,
            confidenceScore: p.problem.confidenceScore,
            severityScore: p.problem.severityScore,
            trendScore: p.problem.trendScore,
            evidenceCount: p.problem.evidenceCount,
            contactHint: p.problem.contactHint,
            cluster: p.problem.cluster
              ? { id: p.problem.cluster.id, clusterName: p.problem.cluster.clusterName }
              : null,
          }
        : null,
    })),
    problems: problems.map((p) => ({
      id: p.id,
      problemText: p.problemText,
      confidenceScore: p.confidenceScore,
      severityScore: p.severityScore,
      trendScore: p.trendScore,
      evidenceCount: p.evidenceCount,
      contactHint: p.contactHint,
      cluster: p.cluster ? { id: p.cluster.id, clusterName: p.cluster.clusterName } : null,
      subreddit: p.post.subreddit,
      author: p.post.author,
      postUrl: p.post.postUrl,
    })),
    logs,
    runDiff,
  });
}

