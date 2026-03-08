import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runProjectPipeline, type PipelineStartStage } from "@/lib/pipeline";
import { pipelineQueue } from "@/lib/job-queue";

const STAGES: readonly PipelineStartStage[] = [
  "SCRAPE",
  "KEYWORDS",
  "REDDIT_FETCH",
  "AI_EXTRACT",
  "CLUSTER",
] as const;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      projectId?: string;
      startStage?: string;
      resetData?: boolean;
    };

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (project.status === "RUNNING") {
      return NextResponse.json({ error: "Project is already running." }, { status: 409 });
    }

    const startStage =
      typeof body.startStage === "string" && STAGES.includes(body.startStage as PipelineStartStage)
        ? (body.startStage as PipelineStartStage)
        : undefined;

    const resetData = Boolean(body.resetData);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "PENDING", stage: "QUEUED", errorMessage: null },
    });

    const run = await prisma.projectRun.create({
      data: { projectId, status: "PENDING", stage: "QUEUED" },
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

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rerun failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

