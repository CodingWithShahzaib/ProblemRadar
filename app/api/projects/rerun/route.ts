import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { runProjectPipeline, type PipelineStartStage } from "@/lib/pipeline";
import { pipelineQueue } from "@/lib/job-queue";
import { authOptions } from "@/lib/auth";
import {
  assertRunQuota,
  assertSourceAllowed,
  bumpUsage,
  getOrgPlan,
  requireOrgContext,
} from "@/lib/billing";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

const STAGES: readonly PipelineStartStage[] = [
  "SCRAPE",
  "KEYWORDS",
  "REDDIT_FETCH",
  "AI_EXTRACT",
  "CLUSTER",
] as const;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      projectId?: string;
      startStage?: string;
      resetData?: boolean;
    };

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true, orgId: true, sourcesJson: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (project.status === "RUNNING") {
      return NextResponse.json({ error: "Project is already running." }, { status: 409 });
    }

    const { orgId } = await requireOrgContext(session.user.id);
    if (project.orgId && project.orgId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { plan } = await getOrgPlan(orgId);
    const sources = project.sourcesJson ? (JSON.parse(project.sourcesJson) as string[]) : ["REDDIT"];
    await assertSourceAllowed(orgId, plan, sources);
    await assertRunQuota(orgId, plan);
    if (!rateLimit(`rerun:${session.user.id}`, 15, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const startStage =
      typeof body.startStage === "string" && STAGES.includes(body.startStage as PipelineStartStage)
        ? (body.startStage as PipelineStartStage)
        : undefined;

    const resetData = Boolean(body.resetData);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "PENDING", stage: "QUEUED", errorMessage: null, orgId },
    });

    const run = await prisma.projectRun.create({
      data: { projectId, status: "PENDING", stage: "QUEUED", orgId },
      select: { id: true },
    });

    if (pipelineQueue) {
      await pipelineQueue.add(
        "pipeline",
        { projectId, runId: run.id, startStage, resetData },
        { jobId: run.id }
      );
    } else {
      runProjectPipeline(projectId, { runId: run.id, startStage, resetData }).catch(() => {});
    }

    await bumpUsage(orgId, { runsStarted: 1 });
    await audit({
      orgId,
      userId: session.user.id,
      action: "project.rerun",
      target: projectId,
      metadata: { startStage, resetData },
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rerun failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

