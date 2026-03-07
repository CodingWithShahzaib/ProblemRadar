import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { searchRedditPosts } from "@/lib/reddit";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      keyword?: string;
      limit?: number;
      projectId?: string;
    };

    const keyword = typeof body.keyword === "string" ? body.keyword : "";
    if (!keyword.trim()) {
      return NextResponse.json({ error: "Missing keyword" }, { status: 400 });
    }

    const posts = await searchRedditPosts({
      keyword,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });

    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    let stored = 0;

    if (projectId) {
      const before = await prisma.post.count({ where: { projectId } });
      const data = posts.map((p) => ({
        projectId,
        title: p.title,
        content: p.selftext,
        author: p.author,
        subreddit: p.subreddit,
        upvotes: p.upvotes,
        comments: p.comments,
        postUrl: p.post_url,
        redditCreatedAt: new Date(p.created_at),
        matchedKeyword: keyword,
      }));

      for (const row of data) {
        await prisma.post.upsert({
          where: { projectId_postUrl: { projectId, postUrl: row.postUrl } },
          create: row,
          update: {
            title: row.title,
            content: row.content,
            author: row.author,
            subreddit: row.subreddit,
            upvotes: row.upvotes,
            comments: row.comments,
            redditCreatedAt: row.redditCreatedAt,
            matchedKeyword: row.matchedKeyword,
          },
        });
      }

      const total = await prisma.post.count({ where: { projectId } });
      stored = Math.max(0, total - before);
      await prisma.project.update({
        where: { id: projectId },
        data: { postCount: total },
      });
    }

    return NextResponse.json({ keyword, stored, posts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reddit search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

