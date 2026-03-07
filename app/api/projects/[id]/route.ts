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
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const [clusters, posts] = await Promise.all([
    prisma.cluster.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        clusterName: true,
        _count: { select: { problems: true } },
      },
    }),
    prisma.post.findMany({
      where: { projectId: id },
      orderBy: { upvotes: "desc" },
      take: 200,
      include: {
        problem: { include: { cluster: true } },
      },
    }),
  ]);

  return NextResponse.json({
    project: {
      ...project,
      keywords: parseKeywords(project.keywordsJson),
    },
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
  });
}

