import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireOrgContext } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId } = await requireOrgContext(session.user.id);
  const schedules = await prisma.schedule.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await requireOrgContext(session.user.id);
    const body = (await req.json()) as { projectId?: string; cron?: string; active?: boolean };
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { orgId: true } });
    if (!project || (project.orgId && project.orgId !== orgId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const cron = body.cron ?? "daily";
    const schedule = await prisma.schedule.create({
      data: { projectId, orgId, cron, active: body.active ?? true },
    });
    return NextResponse.json({ schedule });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
