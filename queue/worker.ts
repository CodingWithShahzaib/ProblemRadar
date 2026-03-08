import "dotenv/config";
import { Worker } from "bullmq";

import { type PipelineJobData } from "@/lib/job-queue";
import { prisma } from "@/lib/prisma";
import { runProjectPipeline } from "@/lib/pipeline";

if (!process.env.REDIS_URL) {
  console.error("REDIS_URL not set. BullMQ worker cannot start.");
  process.exit(1);
}

const worker = new Worker<PipelineJobData>(
  "pipeline",
  async (job) => {
    const { projectId, runId, startStage, resetData } = job.data;
    await runProjectPipeline(projectId, { runId, startStage, resetData: Boolean(resetData) });
    return { ok: true };
  },
  { connection: { url: process.env.REDIS_URL } }
);

worker.on("completed", async (job) => {
  const { runId } = job.data;
  if (runId) {
    await prisma.projectRun.updateMany({
      where: { id: runId, status: { not: "DONE" } },
      data: { status: "DONE", stage: "DONE" },
    });
  }
});

worker.on("failed", async (job, err) => {
  if (!job) return;
  const { runId, projectId } = job.data;
  const message = err?.message ?? "Job failed";
  if (runId) {
    await prisma.projectRun.updateMany({
      where: { id: runId },
      data: { status: "ERROR", stage: "ERROR", errorMessage: message },
    });
  }
  if (projectId) {
    await prisma.project.updateMany({
      where: { id: projectId },
      data: { status: "ERROR", stage: "ERROR", errorMessage: message },
    });
  }
});

console.log("Pipeline worker listening with BullMQ...");

