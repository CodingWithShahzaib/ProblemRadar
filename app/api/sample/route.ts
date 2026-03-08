import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureOrgForUser, requireOrgContext } from "@/lib/billing";
import { SAMPLE_PROJECT_URL } from "@/lib/sample";

const sampleProblems = [
  {
    title: "Customer onboarding is confusing",
    content: "Our users keep dropping at the third step of onboarding. Need clearer guidance.",
    subreddit: "productmanagement",
  },
  {
    title: "Export fails on large datasets",
    content: "When exporting more than 10k rows the tool times out and support is slow to respond.",
    subreddit: "analytics",
  },
];

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await requireOrgContext(session.user.id);

    const existing = await prisma.project.findFirst({
      where: { orgId, url: SAMPLE_PROJECT_URL },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ projectId: existing.id });
    }

    const project = await prisma.project.create({
      data: {
        url: SAMPLE_PROJECT_URL,
        searchSource: "REDDIT",
        status: "DONE",
        stage: "DONE",
        orgId,
        createdByUserId: session.user.id,
        keywordsJson: JSON.stringify(["onboarding", "export", "api"]),
        keywordCount: 3,
        sourcesJson: JSON.stringify(["REDDIT"]),
      },
      select: { id: true },
    });

    for (const p of sampleProblems) {
      const postId = randomUUID();
      await prisma.post.create({
        data: {
          id: postId,
          projectId: project.id,
          title: p.title,
          content: p.content,
          author: "sample_user",
          subreddit: p.subreddit,
          source: "REDDIT",
          upvotes: 42,
          comments: 12,
          postUrl: `https://reddit.com/sample/${postId}`,
          matchedKeyword: "sample",
        },
      });
      await prisma.problem.create({
        data: {
          postId,
          problemText: p.title,
          confidenceScore: 0.8,
          severityScore: 0.7,
          trendScore: 0.5,
          evidenceCount: 1,
        },
      });
    }

    const firstPost = await prisma.post.findFirst({
      where: { projectId: project.id },
      select: { id: true },
    });
    const firstProblem = firstPost
      ? await prisma.problem.findUnique({ where: { postId: firstPost.id }, select: { postId: true } })
      : null;

    await prisma.cluster.create({
      data: {
        projectId: project.id,
        clusterName: "Onboarding",
        problems: firstProblem ? { connect: { postId: firstProblem.postId } } : undefined,
      },
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { postCount: sampleProblems.length, problemCount: sampleProblems.length, clusterCount: 1 },
    });

    return NextResponse.json({ projectId: project.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create sample.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
