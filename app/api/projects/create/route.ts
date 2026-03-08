import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertSafeHttpUrl } from "@/lib/url";
import { runProjectPipeline } from "@/lib/pipeline";
import { pipelineQueue } from "@/lib/job-queue";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string; searchSource?: "REDDIT" | "OPENAI_WEB" };
    const raw = typeof body.url === "string" ? body.url.trim() : "";
    if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const url = (await assertSafeHttpUrl(raw)).toString();

    const envPrefersOpenAI = process.env.USE_OPENAI === "true";
    const searchSource = envPrefersOpenAI
      ? "OPENAI_WEB"
      : body.searchSource === "OPENAI_WEB" || body.searchSource === "REDDIT"
        ? body.searchSource
        : "REDDIT";

    const project = await prisma.project.create({
      data: { url, status: "PENDING", stage: "QUEUED", searchSource },
      select: { id: true },
    });

    const run = await prisma.projectRun.create({
      data: { projectId: project.id, status: "PENDING", stage: "QUEUED" },
      select: { id: true },
    });

    if (pipelineQueue) {
      await pipelineQueue.add(
        "pipeline",
        { projectId: project.id, runId: run.id, startStage: "SCRAPE", resetData: false },
        { jobId: run.id }
      );
    } else {
      runProjectPipeline(project.id, { runId: run.id }).catch(() => {
        // errors persisted in project/run
      });
    }

    return NextResponse.json({ projectId: project.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

