import { prisma } from "@/lib/prisma";
import { extractProblemFromPost } from "@/lib/openai";

function contactHint(text: string) {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) return emailMatch[0];
  const urlMatch = text.match(/https?:\/\/[^\s)]+/i);
  if (urlMatch) return urlMatch[0];
  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIdx = 0;

  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function analyzePostsForProject(params: {
  projectId: string;
  batchSize?: number;
  concurrency?: number;
}) {
  const batchSize = Math.max(1, Math.min(50, params.batchSize ?? 10));
  const concurrency = Math.max(1, Math.min(10, params.concurrency ?? 5));

  const posts = await prisma.post.findMany({
    where: {
      projectId: params.projectId,
      problem: null,
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  const extracted = await mapWithConcurrency(posts, concurrency, async (p) => {
    const result = await extractProblemFromPost({
      title: p.title,
      content: p.content,
      author: p.author,
      subreddit: p.subreddit,
      source: p.source,
      upvotes: p.upvotes,
      comments: p.comments,
      postUrl: p.postUrl,
    });

    return {
      postId: p.id,
      upvotes: p.upvotes,
      comments: p.comments,
      createdAt: p.redditCreatedAt,
      contact: contactHint(p.content),
      ...result,
    };
  });

  const toCreate = extracted
    .filter((r) => r.problemText)
    .map((r) => {
      const ageDays = r.createdAt ? Math.max(1, (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000) : 30;
      const severity = Math.min(1, (r.upvotes / 50 + r.comments / 20 + (r.confidenceScore ?? 0.5)) / 3);
      const trendScore = Math.max(0, Math.min(1, (r.upvotes + r.comments) / (ageDays * 10)));
      return {
        postId: r.postId,
        problemText: r.problemText as string,
        confidenceScore: r.confidenceScore ?? 0.5,
        severityScore: severity,
        trendScore,
        evidenceCount: 1,
        contactHint: r.contact,
      };
    });

  const beforeCount = await prisma.problem.count({
    where: { post: { projectId: params.projectId } },
  });

  for (const row of toCreate) {
    await prisma.problem.upsert({
      where: { postId: row.postId },
      create: row,
      update: {
        problemText: row.problemText,
        confidenceScore: row.confidenceScore,
      },
    });
  }

  const problemCount = await prisma.problem.count({
    where: { post: { projectId: params.projectId } },
  });

  await prisma.project.update({
    where: { id: params.projectId },
    data: { problemCount },
  });

  return {
    scanned: posts.length,
    created: Math.max(0, problemCount - beforeCount),
    problemCount,
    done: posts.length < batchSize,
  };
}

