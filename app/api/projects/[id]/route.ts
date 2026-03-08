import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      status: true,
      stage: true,
      errorMessage: true,
      keywordsJson: true,
      keywordCount: true,
      postCount: true,
      problemCount: true,
      clusterCount: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  return NextResponse.json({
    project: {
      ...project,
      keywords: parseKeywords(project.keywordsJson),
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
      cluster: p.cluster ? { id: p.cluster.id, clusterName: p.cluster.clusterName } : null,
      subreddit: p.post.subreddit,
      author: p.post.author,
      postUrl: p.post.postUrl,
    })),
    logs,
  });
}

