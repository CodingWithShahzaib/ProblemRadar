import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { assertSafeHttpUrl } from "@/lib/url";
import { runProjectPipeline } from "@/lib/pipeline";
import { pipelineQueue } from "@/lib/job-queue";
import { authOptions } from "@/lib/auth";
import {
  assertProjectQuota,
  assertRunQuota,
  assertSourceAllowed,
  bumpUsage,
  getOrgPlan,
  requireOrgContext,
} from "@/lib/billing";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      url?: string;
      searchSource?: "REDDIT" | "OPENAI_WEB";
      sources?: string[];
    };
    const raw = typeof body.url === "string" ? body.url.trim() : "";
    if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const url = (await assertSafeHttpUrl(raw)).toString();
    const userId = session.user.id;
    const { orgId } = await requireOrgContext(userId);
    const { plan } = await getOrgPlan(orgId);

    const allowSources = Array.isArray(body.sources) && body.sources.length > 0 ? body.sources : ["REDDIT"];
    await assertSourceAllowed(orgId, plan, allowSources);
    await assertProjectQuota(orgId, plan);
    await assertRunQuota(orgId, plan);

    if (!rateLimit(`create:${userId}`, 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const envPrefersOpenAI = process.env.USE_OPENAI === "true";
    const searchSource = envPrefersOpenAI
      ? "OPENAI_WEB"
      : body.searchSource === "OPENAI_WEB" || body.searchSource === "REDDIT"
        ? body.searchSource
        : "REDDIT";

    const project = await prisma.project.create({
      data: {
        url,
        status: "PENDING",
        stage: "QUEUED",
        searchSource,
        orgId,
        createdByUserId: userId,
        sourcesJson: JSON.stringify(allowSources),
      },
      select: { id: true },
    });

    const run = await prisma.projectRun.create({
      data: { projectId: project.id, status: "PENDING", stage: "QUEUED", orgId },
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

    await bumpUsage(orgId, { projectsCreated: 1, runsStarted: 1 });
    await audit({ orgId, userId, action: "project.create", target: project.id, metadata: { url } });

    return NextResponse.json({ projectId: project.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

