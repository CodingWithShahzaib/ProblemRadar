import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pipelineQueue } from "@/lib/job-queue";
import { runProjectPipeline } from "@/lib/pipeline";
import { requireOrgContext, bumpUsage } from "@/lib/billing";

function shouldRun(cron: string, lastRunAt: Date | null) {
  if (!lastRunAt) return true;
  const now = Date.now();
  const last = lastRunAt.getTime();
  if (cron === "weekly") return now - last > 6 * 86_400_000;
  return now - last > 23 * 3_600_000;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId } = await requireOrgContext(session.user.id);

  const schedules = await prisma.schedule.findMany({
    where: { orgId, active: true },
    select: { id: true, projectId: true, cron: true, lastRunAt: true },
  });

  const triggered: string[] = [];
  for (const sched of schedules) {
    if (!shouldRun(sched.cron, sched.lastRunAt)) continue;
    const run = await prisma.projectRun.create({
      data: { projectId: sched.projectId, status: "PENDING", stage: "QUEUED", orgId },
      select: { id: true },
    });
    if (pipelineQueue) {
      await pipelineQueue.add("pipeline", { projectId: sched.projectId, runId: run.id, resetData: false }, { jobId: run.id });
    } else {
      runProjectPipeline(sched.projectId, { runId: run.id }).catch(() => {});
    }
    await bumpUsage(orgId, { runsStarted: 1 });
    triggered.push(sched.id);
    await prisma.schedule.update({
      where: { id: sched.id },
      data: { lastRunAt: new Date() },
    });
  }

  return NextResponse.json({ triggered });
}
