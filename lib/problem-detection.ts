import { prisma } from "@/lib/prisma";
import { extractProblemFromRedditPost } from "@/lib/openai";

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
    const result = await extractProblemFromRedditPost({
      title: p.title,
      content: p.content,
      author: p.author,
      subreddit: p.subreddit,
      upvotes: p.upvotes,
      comments: p.comments,
      postUrl: p.postUrl,
    });

    return {
      postId: p.id,
      ...result,
    };
  });

  const toCreate = extracted
    .filter((r) => r.problemText)
    .map((r) => ({
      postId: r.postId,
      problemText: r.problemText as string,
      confidenceScore: r.confidenceScore ?? 0.5,
    }));

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

