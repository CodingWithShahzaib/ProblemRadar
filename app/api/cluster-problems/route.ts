import { NextResponse } from "next/server";

import { clusterProblemsForProject } from "@/lib/clustering";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      projectId?: string;
      similarityThreshold?: number;
    };

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const result = await clusterProblemsForProject({
      projectId,
      similarityThreshold:
        typeof body.similarityThreshold === "number" ? body.similarityThreshold : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clustering failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

