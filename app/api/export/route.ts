import { NextResponse } from "next/server";
import { createObjectCsvStringifier } from "csv-writer";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getOrgPlan, requireOrgContext, bumpUsage } from "@/lib/billing";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId } = await requireOrgContext(session.user.id);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  if (!project || (project.orgId && project.orgId !== orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!rateLimit(`export:${session.user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many exports" }, { status: 429 });
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

  await bumpUsage(orgId, { exportsCount: 1 });
  await audit({ orgId, userId: session.user.id, action: "export.csv", target: projectId });

  return new NextResponse(content, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

