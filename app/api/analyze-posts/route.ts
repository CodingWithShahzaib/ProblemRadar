import { NextResponse } from "next/server";

import { analyzePostsForProject } from "@/lib/problem-detection";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      projectId?: string;
      batchSize?: number;
      concurrency?: number;
    };

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const result = await analyzePostsForProject({
      projectId,
      batchSize: typeof body.batchSize === "number" ? body.batchSize : undefined,
      concurrency: typeof body.concurrency === "number" ? body.concurrency : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyze failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

