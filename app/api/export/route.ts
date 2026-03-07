import { NextResponse } from "next/server";
import { createObjectCsvStringifier } from "csv-writer";

import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const leads = await prisma.post.findMany({
    where: { projectId, problem: { isNot: null } },
    orderBy: { upvotes: "desc" },
    take: 5000,
    select: {
      author: true,
      subreddit: true,
      postUrl: true,
      problem: { select: { problemText: true } },
    },
  });

  const records = leads.map((p) => ({
    username: p.author,
    subreddit: p.subreddit,
    problem: p.problem?.problemText ?? "",
    post_url: p.postUrl,
  }));

  const csv = createObjectCsvStringifier({
    header: [
      { id: "username", title: "username" },
      { id: "subreddit", title: "subreddit" },
      { id: "problem", title: "problem" },
      { id: "post_url", title: "post_url" },
    ],
  });

  const content = csv.getHeaderString() + csv.stringifyRecords(records);
  const filename = `problemradar-leads-${projectId}.csv`;

  return new NextResponse(content, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

