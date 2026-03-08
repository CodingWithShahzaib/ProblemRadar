import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/billing";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await requireOrgContext(session.user.id);
    const body = (await req.json()) as { projectId?: string; webhookUrl?: string };
    if (!body.projectId || !body.webhookUrl) {
      return NextResponse.json({ error: "projectId and webhookUrl required" }, { status: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { orgId: true } });
    if (!project || (project.orgId && project.orgId !== orgId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const leads = await prisma.post.findMany({
      where: { projectId: body.projectId, problem: { isNot: null } },
      take: 500,
      select: {
        author: true,
        subreddit: true,
        postUrl: true,
        problem: { select: { problemText: true, contactHint: true, severityScore: true } },
      },
    });
    await fetch(body.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: body.projectId, leads }),
    });
    await audit({ orgId, userId: session.user.id, action: "export.webhook", target: body.projectId, metadata: { webhookUrl: body.webhookUrl } });
    return NextResponse.json({ ok: true, count: leads.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
